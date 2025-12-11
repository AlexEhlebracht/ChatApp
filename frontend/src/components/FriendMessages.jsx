import React, { useState, useEffect } from "react";
import "../styles/Messages.css";
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

const FriendMessages = ({
  friends,
  setActiveTab,
  setFriend,
  hasNewMessage,
  setHasNewMessageFalse,
  isMessagesHidden,
  setIsMessagesHidden,
}) => {
  const isTablet = useMediaQuery("(max-width: 950px)");

  return (
    <div className={`messages-container ${isMessagesHidden ? "hidden" : ""}`}>
      <div className={`messages-header ${isTablet ? "tablet" : ""}`}>
        <img
          src={MessageImage}
          alt="Messages"
          className="messages-icon"
          onClick={() => isTablet && setIsMessagesHidden(false)}
        />
        <p onClick={() => isTablet && setIsMessagesHidden(false)}>Messages</p>
      </div>
      <ul className="messages-list">
        {hasNewMessage.map((friend) => (
          <li
            key={friend.id}
            className="messages-item"
            onClick={() => {
              setActiveTab("Messages");
              setFriend(friend);
              setHasNewMessageFalse(friend);
              isTablet && setIsMessagesHidden(false);
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
            {friend.has_new_message && (
              <div className="messages-new-indicator" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FriendMessages;
