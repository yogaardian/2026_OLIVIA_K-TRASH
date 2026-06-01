import React from "react";
import { useHistory } from "react-router-dom";
import { loadStoredProfile } from "../config/profileConfig";

const TopbarUserProfile = () => {
  const history = useHistory();
  const role = localStorage.getItem("role") || "user";
  const stored = loadStoredProfile(role);
  const username = stored.name || localStorage.getItem("nama") || "User";
  const userId = stored.id || localStorage.getItem("userId") || "001";
  const profilePhoto = stored.profilePhoto || `https://i.pravatar.cc/150?u=${userId}`;

  return (
    <div className="user-profile" style={{ cursor: "pointer" }} onClick={() => history.push("/user/profile")}> 
      <div className="user-avatar">
        <img src={profilePhoto} alt="avatar" />
      </div>
      <div className="user-info">
        <span className="user-name">{username}</span>
        <span className="user-id">{userId}</span>
      </div>
      <span className="dropdown-icon">▼</span>
    </div>
  );
};

export default TopbarUserProfile;
