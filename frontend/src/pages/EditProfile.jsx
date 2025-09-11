import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "../styles/Form.css";
import TypewriterEffect from "../components/TypewriterEffect";
import Close from "../assets/close.png";

const CreateProfile = () => {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef();
  const [fileName, setFileName] = useState("No file chosen");

    useEffect(() => {
      getUserFullName();
    }, []);

  const getUserFullName = useCallback(async () => {
    try {
      const res = await api.get(`/api/profile/`);
      setFirstName(res.data.first_name);
      setLastName(res.data.last_name);
      setProfilePic(res.data.profile_picture);
      setFileName(res.data.profile_picture);
    } catch (err) {
      console.error("Error fetching user full name:", err);
    }
  }, []);

  const handleFileChange = (e) => {
    setFileName(e.target.files[0]?.name || "No file chosen");
    setProfilePic(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("first_name", firstName);
    formData.append("last_name", lastName);
    if (profilePic) formData.append("profile_picture", profilePic);

    try {
      await api.put("/api/profile/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });
      navigate("/"); // go to home page after profile is created
    } catch (err) {
      if (err.response && err.response.data) {
        setError("Failed to create profile. Make sure all fields are filled.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-wrapper">
      <TypewriterEffect />
      <form onSubmit={handleSubmit} className="form-container profile-form">
        <img src={Close} alt="Close" className="form-close" onClick={() => navigate("/")} />
        <h1>Edit Profile</h1>
        {error && <p className="error-message">{error}</p>}
        <input
          type="text"
          placeholder="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
        <div className="form-file">
          <input
            type="file"
            id="file-upload"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <label htmlFor="file-upload">Profile Picture</label>
          <span>{fileName}</span>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Profile"}
        </button>
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
};

export default CreateProfile;
