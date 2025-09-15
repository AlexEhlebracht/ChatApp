import React, { useState, useCallback } from 'react'
import api from "../api";

const SearchProfiles = () => {
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
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


  return (
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
  )
}

export default SearchProfiles