import { useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../constants";
import "../styles/Form.css";
import Show from "../assets/show.png";
import Hide from "../assets/hide.png";
import TypewriterEffect from "./TypewriterEffect";

function Form({ route, method }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [userError, setUserError] = useState("");
  const [passError, setPassError] = useState("");
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);

  const name = method === "login" ? "Login" : "Register";

  const handleSubmit = async (e) => {
    setLoading(true);
    e.preventDefault();
    setUserError("");
    setPassError("");

    if (method === "register" && password !== confirm) {
      setPassError("Passwords do not match");
      return;
    }

    if (username.length === 0) {
      setUserError("Username is required");
      if (password.length === 0) {
        setPassError("Password is required");
        return;
      }
      return;
    }

    if (password.length === 0) {
      setPassError("Password is required");
      if (username.length === 0) {
        setUserError("Username is required");
        return;
      }
      return;
    }

    try {
      const res = await api.post(route, { username, password });
      if (method === "login") {
        localStorage.setItem(ACCESS_TOKEN, res.data.access);
        localStorage.setItem(REFRESH_TOKEN, res.data.refresh);
        // Check if user has a profile
        const profileRes = await api.get("/api/profile/", {
          headers: {
            Authorization: `Bearer ${res.data.access}`,
          },
        });

        if (!profileRes.data.first_name || !profileRes.data.last_name) {
          navigate("/create-profile");
        } else {
          navigate("/"); // profile exists → normal home page
        }
      } else {
        navigate("/login");
      }
    } catch (error) {
      if (error.response && error.response.data) {
        // Extract error messages
        setMessages(Object.values(error.response.data).flat());
        if (
          messages[0] === "No active account found with the given credentials"
        ) {
          setUserError("Invalid username or password");
        }
        if (messages[0] === "A user with that username already exists.") {
          setUserError("Username already taken");
        }
        if (
          messages[0] ===
          "This password is too short. It must contain at least 8 characters."
        ) {
          setPassError("Password must be at least 8 characters");
        }
        if (messages[0] === "This password is too common.") {
          setPassError("Password is too common");
        }
        console.log(messages);
      } else {
        alert("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-wrapper">
      <TypewriterEffect />
      <form onSubmit={handleSubmit} className="form-container">
        <h1>{name}</h1>
        {userError && <p className="error-message">{userError}</p>}
        <input
          className="form-input"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
        />
        {passError && <p className="error-message">{passError}</p>}
        <div className="form-password-wrapper">
          <input
            className="form-input"
            type={passwordVisible ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          <img
            className="toggle-password"
            src={passwordVisible ? Hide : Show}
            alt="Toggle Password Visibility"
            onClick={() => setPasswordVisible(!passwordVisible)}
          />
        </div>
        {method === "register" && (
          <div className="form-password-wrapper">
            <input
              className="form-input"
              type={confirmVisible ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Password"
            />
            <img
              className="toggle-password"
              src={confirmVisible ? Hide : Show}
              alt="Toggle Password Visibility"
              onClick={() => setConfirmVisible(!confirmVisible)}
            />
          </div>
        )}
        <button className="form-button" type="submit">
          {name}
        </button>
        <div>
          {method === "login" ? (
            <p className="form-footer">
              Don't have an account? <a href="/register">Register</a>
            </p>
          ) : (
            <p className="form-footer">
              Already have an account? <a href="/login">Login</a>
            </p>
          )}
        </div>
      </form>
      <div className="lines">
        <div className="line"></div>
        <div className="line"></div>
        <div className="line"></div>
        <div className="line"></div>
        <div className="line"></div>
        <div className="line"></div>
        <div className="line"></div>
        <div className="line"></div>
        <div className="line"></div>
        <div className="line"></div>
        <div className="line"></div>
      </div>
    </div>
  );
}

export default Form;
