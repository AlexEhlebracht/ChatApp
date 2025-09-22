import React, { useState, useCallback } from "react";
import api from "../api";
import AddFriend from "./AddFriend";

const SearchProfiles = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [didSearch, setDidSearch] = useState(false);

  // Actual search function
  const performSearch = useCallback(async () => {
    if (!searchQuery) return;
    try {
      const res = await api.get(`/api/users/search/?q=${searchQuery}`);
      setSearchResults(res.data);
      console.log("Search results:", res.data);
    } catch (err) {
      console.error("Error searching users:", err);
    }
  }, [searchQuery]);

  // Form submit handler
  const handleSearch = useCallback(
    async (e) => {
      e.preventDefault();
      await performSearch();
      setDidSearch(true);
    },
    [performSearch]
  );

  // Friend request actions
  const sendFriendRequest = useCallback(
    async (username) => {
      try {
        await api.post("/api/friends/request/", { to_username: username });
        // Re-run search to remove the user who just got a request
        await performSearch();
      } catch (err) {
        console.error("Error sending friend request:", err);
        alert("Failed to send friend request");
      }
    },
    [performSearch]
  );

  return (
    <div className="search-form">
      <form onSubmit={handleSearch} className="search-bar">
        <input
          type="text"
          placeholder="Search by name"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>
      <ul className="friend-list">
        {searchResults.map((user) => (
          <li key={user.id}>
            <AddFriend
              profile={user}
              id={user.id}
              sendFriendRequest={sendFriendRequest}
            />
          </li>
        ))}
        {searchResults.length === 0 && searchQuery && didSearch && (
          <p>No users found</p>
        )}
      </ul>
    </div>
  );
};

export default SearchProfiles;
