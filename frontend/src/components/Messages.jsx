import React, { useState, useEffect, useRef } from "react";
import "../styles/Messages.css";
import api from "../api";

const Messages = ({ friend, currentUserId, ws }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const messagesEndRef = useRef(null);
  const messageContentRef = useRef(null);
  const [newMessage, setNewMessage] = useState(false);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);

  useEffect(() => {
    if (!ws?.current) return;

    const typingState = text.trim() !== "";

    if (typingState !== isTyping) {
      setIsTyping(typingState);

      ws.current.send(
        JSON.stringify({
          event: "typing",
          receiver_id: friend.user_id,
          is_typing: typingState,
        })
      );
    }
  }, [text]);

  // Scroll to bottom when messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setNewMessage(false);
  };

  const scrollToBottomInstant = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    setNewMessage(false);
  };

  // Check if user is at the bottom
  const isAtBottom = () => {
    if (!messageContentRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = messageContentRef.current;
    // Allow a small buffer (5px) for floating-point inaccuracies
    return scrollTop + clientHeight >= scrollHeight - 100;
  };

  useEffect(() => {
    if (isAtBottom()) {
      scrollToBottom();
    }
  }, [messages]);

  // Fetch chat history
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await api.get(`/api/messages/${friend.user_id}/`);
        setMessages(res.data);
        setTimeout(() => {
          scrollToBottomInstant();
        }, 1);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };
    fetchMessages();
  }, [friend.id]);

  // WebSocket listener
  useEffect(() => {
    if (!ws || !ws.current) return;

    const handleMessage = (e) => {
      const data = JSON.parse(e.data);
      if (
        data.event === "new_message" ||
        data.event === "chat_message" ||
        data.event === "message_sent"
      ) {
        const msg = data.message;
        if (msg.sender === friend.user_id || msg.receiver === friend.user_id) {
          setMessages((prev) => [...prev, msg]);
          if (msg.sender == String(currentUserId)) {
            setNewMessage(false);
            setShouldScroll(true); // tell effect to scroll once message is rendered
          } else if (!isAtBottom()) {
            setNewMessage(true);
          }
        }
      }

      if (data.event === "typing_indicator") {
        if (data.user_id === friend.user_id) {
          // Update typing status for the friend
          setFriendTyping(data.is_typing);
          requestAnimationFrame(() => {
            if (isAtBottom()) {
              scrollToBottom();
            }
          });
        }
      }
    };

    ws.current.addEventListener("message", handleMessage);
    return () => ws.current.removeEventListener("message", handleMessage);
  }, [friend.id, ws]);

  useEffect(() => {
    if (shouldScroll) {
      scrollToBottom();
      setShouldScroll(false);
    }
  }, [messages, shouldScroll]);

  const sendMessage = async () => {
    if (!text.trim()) return;

    const messageData = {
      event: "send_message",
      receiver: friend.user_id,
      content: text.trim(),
    };

    // Send via WebSocket
    ws.current.send(JSON.stringify(messageData));

    // Persist via API
    try {
      await api.post("/api/messages/", {
        receiver: friend.user_id,
        content: text.trim(),
      });
    } catch (err) {
      if (err.response) {
        console.error("API Error Data:", err.response.data);
      } else {
        console.error("Error:", err);
      }
    }

    setText("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="message-container">
      <div className="message-header">
        <img
          src={friend.profile_picture}
          alt={`${friend.first_name} ${friend.last_name}`}
          className="message-header-pic"
        />
        <div className="message-header-name">
          <h2>
            {friend.first_name} {friend.last_name}
          </h2>
          <p>@{friend.username}</p>
        </div>
      </div>
      <div className="message-content-wrapper">
        <div className="message-content" ref={messageContentRef}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message-bubble ${
                msg.sender == currentUserId ? "sent" : "received"
              }`}
            >
              <p className="message-text-content">{msg.content}</p>
              <span className="message-timestamp">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
          {friendTyping && (
            <div className="typing-indicator message-text-content">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
        </div>
        {newMessage && (
          <div className="message-indicator" onClick={scrollToBottom}>
            New message
          </div>
        )}
      </div>

      <div className="message-text">
        <div className="message-textarea-wrapper">
          <textarea
            placeholder="Type your message here..."
            className="message-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyPress={handleKeyPress}
          />
        </div>
        <button className="message-send-button" onClick={sendMessage}>
          Send
        </button>
      </div>
    </div>
  );
};

export default Messages;
