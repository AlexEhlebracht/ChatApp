import React, { useState, useEffect, useRef } from "react";
import "../styles/Messages.css";
import api from "../api";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm"; // GitHub Flavored Markdown (tables, strikethrough, etc.)
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight"; // Code syntax highlighting
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css"; // Code highlighting theme

const Messages = ({ friend, currentUserId, ws }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const messagesEndRef = useRef(null);
  const messageContentRef = useRef(null);
  const [newMessage, setNewMessage] = useState(false);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const GROUP_THRESHOLD = 2 * 60 * 1000; // 2 minutes

  const shouldShowTimestamp = (msg, nextMsg) => {
    if (!nextMsg) return true; // last message always shows
    // Show timestamp if sender changes or gap > threshold
    return (
      msg.sender !== nextMsg.sender ||
      new Date(nextMsg.timestamp) - new Date(msg.timestamp) > GROUP_THRESHOLD
    );
  };

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
    const box = messageContentRef.current;

    const handleScroll = () => {
      console.log("Box scrolled:", box.scrollTop);
      if (isAtBottom()) {
        setNewMessage(false);
      }
    };

    box.addEventListener("scroll", handleScroll);

    return () => box.removeEventListener("scroll", handleScroll);
  }, []);

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
    try {
      await api.get(
        `/api/change_new_message_true/?friend_id=${friend.user_id}`
      );
    } catch (err) {
      console.error("Error updating new message status:", err);
    }

    setText("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // Check if it's likely a physical keyboard
      // Virtual keyboards on mobile typically have inputMode="text"
      // and the keyboard event properties are different
      const isLikelyPhysicalKeyboard = window.innerWidth > 600;

      if (isLikelyPhysicalKeyboard) {
        e.preventDefault();
        sendMessage();
      }
    }
  };

  const formatTimestamp = (ts) => {
    const date = new Date(ts);
    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return (
      date.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
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
          {messages.map((msg, i) => {
            const nextMsg = messages[i + 1];
            const showTimestamp = shouldShowTimestamp(msg, nextMsg);

            return (
              <div
                key={msg.id}
                className={`message-bubble ${
                  msg.sender == currentUserId ? "sent" : "received"
                }`}
              >
                <div className="message-text-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath, remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={{
                      a: ({ node, ...props }) => (
                        <a
                          {...props}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      ),
                      code: ({
                        node,
                        inline,
                        className,
                        children,
                        ...props
                      }) => {
                        return inline ? (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
                {showTimestamp && (
                  <span className="message-timestamp">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                )}
              </div>
            );
          })}
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
