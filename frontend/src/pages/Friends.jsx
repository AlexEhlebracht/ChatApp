import React, { useState, useEffect, useCallback, act } from "react";
import api from "../api";
import { jwtDecode } from "jwt-decode";
import "../styles/Friends.css";
import FriendsImage from "../assets/friends.png";
import AddFriendsW from "../assets/add-userW.png";
import AddFriendsB from "../assets/add-userB.png";
import { useNavigate } from "react-router-dom";
import Friend from "../components/Friend";
import SearchProfiles from "../components/SearchProfiles";
import PendingFriends from "../components/PendingFriend";
import FriendMessages from "../components/FriendMessages";
import Messages from "../components/Messages";
import MessageImage from "../assets/message.png";

const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);

    return () => media.removeEventListener("change", listener);
  }, [matches, query]);

  return matches;
};

const Friends = () => {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("activeTab") || "Online";
  });
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [ws, setWs] = useState(null);
  const [isAddNewHovered, setIsAddNewHovered] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [friend, setFriend] = useState(() => {
    // This runs ONCE on mount, before first render
    const savedFriend = localStorage.getItem("friend");
    if (savedFriend) {
      try {
        return JSON.parse(savedFriend);
      } catch (error) {
        console.error("Error parsing saved friend:", error);
        localStorage.removeItem("friend");
        return null;
      }
    }
    return null;
  });
  console.log("Current friend:", friend);
  const wRef = React.useRef(null);
  const [hasNewMessage, setHasNewMessage] = useState([]);
  const friendRef = React.useRef(null);
  const activeTabRef = React.useRef(activeTab);
  const isTablet = useMediaQuery("(max-width: 950px)");
  const [isMessagesHidden, setIsMessagesHidden] = useState(isTablet);

  const navigate = useNavigate();

  function logOut() {
    localStorage.clear();
    navigate("/login");
  }

  function editProfile() {
    navigate("/edit-profile");
  }

  useEffect(() => {
    friendRef.current = friend;
    if (friend) {
      localStorage.setItem("friend", JSON.stringify(friend));
    }
  }, [friend]);

  useEffect(() => {
    activeTabRef.current = activeTab;
    localStorage.setItem("activeTab", activeTab);
  }, [activeTab]);

  // Fetch friends
  const fetchFriends = useCallback(async () => {
    try {
      const res = await api.get("/api/friends/");
      setFriends(res.data);
      //console.log("Fetched friends:", res.data);
    } catch (err) {
      console.error("Error fetching friends:", err);
    }
  }, []);

  const fetchHasNewMessage = useCallback(async () => {
    try {
      const res = await api.get("/api/has_new_message/");
      setHasNewMessage(res.data);
      console.log("Fetched has new message:", res.data);
    } catch (err) {
      console.error("Error fetching has new message:", err);
    }
  }, []);

  // Fetch pending requests
  const fetchPendingRequests = useCallback(async () => {
    try {
      const res = await api.get("/api/friends/incoming/");
      setPendingRequests(res.data);
      console.log("Fetched pending requests:", res.data);
    } catch (err) {
      console.error("Error fetching pending requests:", err);
    }
  }, []);

  const acceptRequest = useCallback(
    async (id) => {
      try {
        await api.put(`/api/friends/accept/${id}/`);
        await fetchPendingRequests();
        await fetchFriends();
        await fetchHasNewMessage();
      } catch (err) {
        console.error("Error accepting request:", err);
      }
    },
    [fetchPendingRequests, fetchFriends, fetchHasNewMessage]
  );

  const rejectRequest = useCallback(
    async (id) => {
      try {
        await api.delete(`/api/friends/reject/${id}/`);
        await fetchPendingRequests();
      } catch (err) {
        console.error("Error rejecting request:", err);
      }
    },
    [fetchPendingRequests]
  );

  const getUserFullName = useCallback(async () => {
    try {
      const res = await api.get(`/api/profile/`);
      setFirstName(res.data.first_name);
      setLastName(res.data.last_name);
      setProfilePic(res.data.profile_picture);
      setUsername(res.data.username);
    } catch (err) {
      console.error("Error fetching user full name:", err);
    }
  }, [userId]);

  // Decode JWT on mount
  useEffect(() => {
    const token = localStorage.getItem("access");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUserId(decoded.user_id);
        setIsAuthenticated(true);
      } catch (err) {
        console.error("JWT decode error:", err);
      }
    }
  }, []);

  // Fetch friends once authenticated
  useEffect(() => {
    if (isAuthenticated && userId) {
      fetchFriends();
      fetchPendingRequests();
      getUserFullName();
      fetchHasNewMessage();
    }
  }, [
    isAuthenticated,
    userId,
    fetchFriends,
    fetchPendingRequests,
    fetchHasNewMessage,
  ]);

  // WebSocket connection
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    let socket = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let reconnectTimer = null;
    let pingInterval = null;

    const connect = () => {
      // Close existing connection if any
      if (socket) {
        socket.close();
      }

      console.log("🔄 Connecting WebSocket...");
      socket = new WebSocket(
        // `ws://10.195.149.38:8000/ws/friends/?user_id=${userId}` // Change to your IP for mobile
        `wss://alexehlebracht-chat-backend.fly.dev/ws/friends/?user_id=${userId}`
      );

      wRef.current = socket;

      socket.onopen = () => {
        console.log("✅ WebSocket connected for user:", userId);
        reconnectAttempts = 0; // Reset on success

        // Send ping every 25 seconds to keep connection alive
        pingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
            console.log("📤 Ping sent");
          }
        }, 25000);
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // Handle pong response
        if (data.type === "pong") {
          console.log("📥 Pong received");
          return;
        }

        if (data.event === "online_status") {
          fetchFriends();
          fetchHasNewMessage();
        }
        if (data.event === "friend_request") {
          fetchPendingRequests();
          fetchHasNewMessage();
        }
        if (data.event === "friend_request_accepted") {
          fetchFriends();
          fetchPendingRequests();
          fetchHasNewMessage();
        }
        console.log("WebSocket message received:", data.event);
        if (data.event === "new_message_dot") {
          fetchHasNewMessage();
          console.log(friendRef.current);
          console.log(activeTabRef.current);
          if (friendRef.current && activeTabRef.current === "Messages") {
            setHasNewMessageFalse(friendRef.current);
          }
        }
      };

      socket.onerror = (err) => {
        console.error("❌ WebSocket error:", err);
      };

      socket.onclose = (event) => {
        console.warn("🔴 WebSocket closed:", event.code, event.reason);

        // Clear ping interval
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }

        // Don't reconnect if clean close
        if (event.code === 1000) {
          console.log("Clean disconnect");
          return;
        }

        // Reconnect with exponential backoff
        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          reconnectAttempts++;

          console.log(
            `🔄 Reconnecting in ${delay}ms... (attempt ${reconnectAttempts}/${maxReconnectAttempts})`
          );

          reconnectTimer = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error("❌ Max reconnection attempts reached");
        }
      };

      setWs(socket);
    };

    // Initial connection
    connect();

    // Handle page visibility (mobile going background/foreground)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log("👁️ App visible, checking connection...");
        if (socket?.readyState !== WebSocket.OPEN) {
          console.log("🔄 Reconnecting...");
          connect();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      if (pingInterval) {
        clearInterval(pingInterval);
      }

      if (socket) {
        socket.close(1000, "Component unmounting");
      }
    };
  }, [
    isAuthenticated,
    userId,
    fetchFriends,
    fetchPendingRequests,
    fetchHasNewMessage,
  ]);

  // Refresh on tab change
  useEffect(() => {
    if (activeTab === "All" || activeTab === "Online") fetchFriends();
    if (activeTab === "Pending") fetchPendingRequests();
  }, [activeTab, fetchFriends, fetchPendingRequests]);

  const setHasNewMessageFalse = async (friend) => {
    try {
      const res = await api.get(
        `/api/change_new_message/?friend_id=${friend.user_id}`
      );

      console.log("Set has new message false response:", res);
      if (res.status === 200) {
        // Optionally refetch friends to update the UI
        fetchHasNewMessage();
        // OR update local state directly to remove the notification
      }
    } catch (error) {
      console.error("Error marking messages as read:", error);
      console.log(friend);
    }
  };

  return (
    <div className="friends-whole">
      <FriendMessages
        friends={friends}
        setActiveTab={setActiveTab}
        setFriend={setFriend}
        hasNewMessage={hasNewMessage}
        setHasNewMessageFalse={setHasNewMessageFalse}
        isMessagesHidden={isMessagesHidden}
        setIsMessagesHidden={setIsMessagesHidden}
      />
      <div className="friends-container">
        <nav className="friends-tabs">
          {isTablet && (
            <div className="friends-header tablet">
              <img
                src={MessageImage}
                alt="Friends"
                className="friends-icon"
                onClick={() => setIsMessagesHidden(true)}
              />
            </div>
          )}
          <div className="friends-nav-center">
            <div className="friends-header">
              <img src={FriendsImage} alt="Friends" />
              Friends
            </div>
            {["Online", "All", "Pending", "Add Friend"].map((tab) => (
              <button
                key={tab}
                className={`
                ${activeTab === tab ? "friends-active" : ""}
                ${tab === "Add Friend" ? "add-friend-class" : ""}
              `}
                onClick={() => setActiveTab(tab)}
                onMouseEnter={
                  tab === "Add Friend"
                    ? () => setIsAddNewHovered(true)
                    : undefined
                }
                onMouseLeave={
                  tab === "Add Friend"
                    ? () => setIsAddNewHovered(false)
                    : undefined
                }
              >
                {tab}
                {tab === "Add Friend" && (
                  <img
                    src={
                      isAddNewHovered && activeTab != "Add Friend"
                        ? AddFriendsB
                        : AddFriendsW
                    }
                  />
                )}
              </button>
            ))}
          </div>
          <div
            className="friends-header-name"
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          >
            <div className="friends-header-username">
              {isAuthenticated ? `${firstName} ${lastName}` : "Not logged in"}
            </div>
            <img src={profilePic} alt="Profile" />
            {profileMenuOpen && (
              <div className="friends-profile-menu">
                <div className="friends-profile-username">{`@${username}`}</div>
                <button onClick={editProfile}>Edit Profile</button>
                <button onClick={logOut}>Logout</button>
              </div>
            )}
          </div>
        </nav>

        <div className="content">
          {activeTab === "Online" && (
            <ul className="friend-list">
              {friends
                .filter((f) => f.is_online)
                .map((f) => (
                  <Friend
                    key={f.id}
                    profile={f}
                    setActiveTab={setActiveTab}
                    setFriend={setFriend}
                    setHasNewMessageFalse={setHasNewMessageFalse}
                    setIsMessagesHidden={setIsMessagesHidden}
                  />
                ))}
            </ul>
          )}

          {activeTab === "All" && (
            <ul className="friend-list">
              {friends.map((f) => (
                <Friend
                  key={f.id}
                  profile={f}
                  setActiveTab={setActiveTab}
                  setFriend={setFriend}
                  setHasNewMessageFalse={setHasNewMessageFalse}
                  setIsMessagesHidden={setIsMessagesHidden}
                />
              ))}
            </ul>
          )}

          {activeTab === "Pending" && (
            <ul className="friend-list">
              {pendingRequests.map((req) => (
                <PendingFriends
                  key={req.id}
                  profile={req.from_user.profile}
                  id={req.id}
                  acceptRequest={acceptRequest}
                  rejectRequest={rejectRequest}
                />
              ))}
              {pendingRequests.length === 0 && <p></p>}
            </ul>
          )}

          {activeTab === "Add Friend" && <SearchProfiles />}
          {activeTab === "Messages" && friend && (
            <Messages friend={friend} currentUserId={userId} ws={wRef} />
          )}
          {activeTab === "Messages" && !friend && (
            <div className="no-friend-selected">
              <p>Select a friend to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Friends;
