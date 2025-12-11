import React from "react";

const Friend = ({
  profile,
  setActiveTab,
  setFriend,
  setHasNewMessageFalse,
  setIsMessagesHidden,
}) => {
  function timeAgo(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now - past; // difference in milliseconds

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  }

  return (
    <div
      className="friend-item"
      onClick={() => {
        setActiveTab("Messages");
        setFriend(profile);
        setHasNewMessageFalse(profile);
        setIsMessagesHidden(false);
      }}
    >
      <div
        className={`friend-pic ${
          profile.is_online ? "friend-online" : "friend-offline"
        }`}
      >
        <img
          className={`friend-image ${
            profile.is_online ? "friend-online" : "friend-offline"
          }`}
          src={profile.profile_picture}
        />
      </div>
      <div className="friend-info">
        <div
          className={`friend-name ${
            profile.is_online ? "friend-online" : "friend-offline"
          }`}
        >
          {profile.first_name} {profile.last_name}
        </div>
        <div className="friend-username">@{profile.username}</div>
      </div>
      <div
        className={`friend-status ${
          profile.is_online ? "friend-online" : "friend-offline"
        }`}
      >
        {profile.is_online
          ? "Active"
          : `Last Seen: ${timeAgo(profile.last_seen)}`}
      </div>
    </div>
  );
};

export default Friend;
