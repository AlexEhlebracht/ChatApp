import React, { useState, useEffect, useCallback } from "react";
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

const Friends = () => {
  const [activeTab, setActiveTab] = useState("Online");
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

  const navigate = useNavigate();

  function logOut() {
    localStorage.clear();
    navigate("/login");
  }

  function editProfile() {
    navigate("/edit-profile");
  }

  // Fetch friends
  const fetchFriends = useCallback(async () => {
    try {
      const res = await api.get("/api/friends/");
      setFriends(res.data);
      console.log("Fetched friends:", res.data);
    } catch (err) {
      console.error("Error fetching friends:", err);
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
      } catch (err) {
        console.error("Error accepting request:", err);
      }
    },
    [fetchPendingRequests, fetchFriends]
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
    }
  }, [isAuthenticated, userId, fetchFriends, fetchPendingRequests]);

  // WebSocket connection
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const socket = new WebSocket(
      `ws://127.0.0.1:8000/ws/friends/?user_id=${userId}`
    );

    socket.onopen = () => {
      console.log("WebSocket connected for user:", userId);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.event === "online_status") {
        // Just refresh the friends list
        fetchFriends();
      }
      if (data.event === "friend_request") {
        // Just refresh the pending requests list
        fetchPendingRequests();
      }
      if (data.event === "friend_request_accepted") {
        fetchFriends();
        fetchPendingRequests();
      }
    };

    socket.onerror = (err) => console.error("WebSocket error:", err);

    socket.onclose = (event) => {
      console.warn("WebSocket closed:", event);
      if (event.code !== 1000) {
        setTimeout(() => {
          console.log("Reconnecting WebSocket...");
        }, 5000);
      }
    };

    setWs(socket);

    return () => {
      socket.close(1000, "Component unmounting");
    };
  }, [isAuthenticated, userId, fetchFriends, fetchPendingRequests]);

  // Refresh on tab change
  useEffect(() => {
    if (activeTab === "All" || activeTab === "Online") fetchFriends();
    if (activeTab === "Pending") fetchPendingRequests();
  }, [activeTab, fetchFriends, fetchPendingRequests]);

  return (
    <div className="friends-whole">
      <FriendMessages friends={friends} />
      <div className="friends-container">
        <nav className="friends-tabs">
          <div className="friends-header">
            <img src={FriendsImage} alt="Friends" />
            Friends
          </div>
          {["Online", "All", "Pending", "Add Friend"].map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? "friends-active" : ""}
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
                <img src={isAddNewHovered ? AddFriendsB : AddFriendsW} />
              )}
            </button>
          ))}
          <div
            className="friends-header-name"
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          >
            <div>
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
                  <Friend key={f.id} profile={f} />
                ))}
            </ul>
          )}

          {activeTab === "All" && (
            <ul className="friend-list">
              {friends.map((f) => (
                <Friend key={f.id} profile={f} />
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
              {pendingRequests.length === 0 && <p>No pending requests</p>}
            </ul>
          )}

          {activeTab === "Add Friend" && <SearchProfiles />}
        </div>
      </div>
    </div>
  );
};

export default Friends;
