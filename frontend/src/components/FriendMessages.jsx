import React from "react";
import "../styles/Messages.css";
import MessageImage from "../assets/message.png";

const FriendMessages = ({ friends }) => {
  return (
    <div className="messages-container">
      <div className="messages-header">
        <img src={MessageImage} alt="Messages" className="messages-icon" />
        <p>Messages</p>
      </div>
      <ul className="friend-list">
        {friends.length === 0 && <p>No friends to display messages for.</p>}
        {friends.map((friend) => (
          <li key={friend.id} className="friend-item">
            <img
              src={friend.profile_picture}
              alt={`${friend.first_name} ${friend.last_name}`}
            />
            <div className="friend-info">
              <div className="friend-name">{`${friend.first_name} ${friend.last_name}`}</div>
              <div className="friend-message">{friend.last_message}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FriendMessages;
