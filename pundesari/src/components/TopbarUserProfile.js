import React from "react";
import { useHistory } from "react-router-dom";
import { loadStoredProfile } from "../config/profileConfig";

const TopbarUserProfile = () => {
  const history = useHistory();
  const role = localStorage.getItem("role") || "user";
  const stored = loadStoredProfile(role);
  const username = stored.name || localStorage.getItem("nama") || "User";
  const userId = stored.id || localStorage.getItem("userId") || "001";
  const profilePhoto = stored.profilePhoto || null;

  return (
    <div className="user-profile" style={{ cursor: "pointer" }} onClick={() => history.push("/user/profile")}> 
      <div className="user-avatar">
        {profilePhoto ? (
          <img src={profilePhoto} alt="avatar" />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#e2e8f0",
              color: "#334155",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            {username?.charAt(0) || "U"}
          </div>
        )}
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
