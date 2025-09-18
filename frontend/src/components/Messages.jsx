import React, { useState, useEffect, useRef } from "react";
import "../styles/Messages.css";
import api from "../api";

const Messages = ({ friend, currentUserId, ws }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages]);

  // Fetch chat history
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await api.get(`/api/messages/${friend.user_id}/`);
        setMessages(res.data);
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
      if (data.event === "new_message" || data.event === "chat_message" || data.event === "message_sent") {
        const msg = data.message;
        console.log("WebSocket message received:", msg);
        console.log("Current friend ID:", friend);
        if (msg.sender === friend.user_id || msg.receiver === friend.user_id) {
          console.log("Received message for current chat:", msg);
          setMessages((prev) => [...prev, msg]);
        }
      }
    };

    ws.current.addEventListener("message", handleMessage);
    return () => ws.current.removeEventListener("message", handleMessage);
  }, [friend.id, ws]);

  const sendMessage = async () => {
    if (!text.trim()) return;

    console.log(friend.user_id);

    const messageData = {
      event: "send_message",
      receiver: friend.user_id,
      content: text.trim(),
    };

    console.log("Sending message:", messageData);

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

      <div className="message-content" style={{ overflowY: "auto", flex: 1 }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message-bubble ${
              msg.sender === currentUserId ? "sent" : "received"
            }`}
          >
            <p>{msg.content}</p>
            <span className="message-timestamp">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="message-text">
        <textarea
          placeholder="Type your message here..."
          className="message-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <button className="message-send-button" onClick={sendMessage}>
          Send
        </button>
      </div>
    </div>
  );
};

export default Messages;
