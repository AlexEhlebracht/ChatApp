import React from "react";
import "../styles/Messages.css";
import MessageImage from "../assets/message.png";

const FriendMessages = ({ friends, setActiveTab, setFriend }) => {
  return (
    <div className="messages-container">
      <div className="messages-header">
        <img src={MessageImage} alt="Messages" className="messages-icon" />
        <p>Messages</p>
      </div>
      <ul className="messages-list">
        {friends.map((friend) => (
          <li
            key={friend.id}
            className="messages-item"
            onClick={() => {
              setActiveTab("Messages");
              setFriend(friend);
            }}
          >
            <img
              src={friend.profile_picture}
              className="messages-pic"
              alt={`${friend.first_name} ${friend.last_name}`}
            />
            <div className="messages-info">
              <div className="messages-name">{`${friend.first_name} ${friend.last_name}`}</div>
              <div className="messages-message">{friend.last_message}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FriendMessages;
