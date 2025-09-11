import React, { useState, useEffect, useCallback } from "react";
import api from "../api";
import { jwtDecode } from "jwt-decode";
import "../styles/Friends.css";
import FriendsImage from "../assets/friends.png";
import AddFriendsW from "../assets/add-userW.png";
import AddFriendsB from "../assets/add-userB.png";
import { useNavigate } from "react-router-dom";
import Friend from "../components/Friend";

const Friends = () => {
  const [activeTab, setActiveTab] = useState("Online");
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [userId, setUserId] = useState(null);
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

  // Search users
  const handleSearch = useCallback(
    async (e) => {
      e.preventDefault();
      if (!searchQuery) return;
      try {
        const res = await api.get(`/api/users/search/?q=${searchQuery}`);
        setSearchResults(res.data);
        console.log("Search results:", res.data);
      } catch (err) {
        console.error("Error searching users:", err);
      }
    },
    [searchQuery]
  );

  // Friend request actions
  const sendFriendRequest = useCallback(async (username) => {
    try {
      await api.post("/api/friends/request/", { to_username: username });
      alert(`Friend request sent to ${username}`);
    } catch (err) {
      console.error("Error sending friend request:", err);
      alert("Failed to send friend request");
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
        await api.put(`/api/friends/reject/${id}/`);
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
              tab === "Add Friend" ? () => setIsAddNewHovered(true) : undefined
            }
            onMouseLeave={
              tab === "Add Friend" ? () => setIsAddNewHovered(false) : undefined
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
              <button onClick={editProfile}>
                Edit Profile
              </button>
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
            {friends.filter((f) => f.is_online).length === 0 && (
              <p>No friends online</p>
            )}
          </ul>
        )}

        {activeTab === "All" && (
          <ul className="friend-list">
            {friends.map((f) => (
              <Friend key={f.id} profile={f} />
            ))}
            {friends.length === 0 && <p>No friends added</p>}
          </ul>
        )}

        {activeTab === "Pending" && (
          <ul className="friend-list">
            {pendingRequests.map((req) => (
              <li key={req.id}>
                {req.from_user.username}
                <div className="actions">
                  <button onClick={() => acceptRequest(req.id)}>Accept</button>
                  <button onClick={() => rejectRequest(req.id)}>Reject</button>
                </div>
              </li>
            ))}
            {pendingRequests.length === 0 && <p>No pending requests</p>}
          </ul>
        )}

        {activeTab === "Add New" && (
          <div className="search-form">
            <form onSubmit={handleSearch}>
              <input
                type="text"
                placeholder="Search by username"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit">Search</button>
            </form>
            <ul className="friend-list">
              {searchResults.map((user) => (
                <li key={user.id}>
                  {user.username}
                  <button onClick={() => sendFriendRequest(user.username)}>
                    Add Friend
                  </button>
                </li>
              ))}
              {searchResults.length === 0 && searchQuery && (
                <p>No users found</p>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Friends;
