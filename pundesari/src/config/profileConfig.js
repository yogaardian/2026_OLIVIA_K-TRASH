const PROFILE_KEYS = {
  user: {
    name: "user_nama",
    email: "user_email",
    phone: "user_nomor_hp",
    photo: "user_profilePhoto",
    id: "userId",
  },
  petugas: {
    name: "petugas_nama",
    email: "petugas_email",
    phone: "petugas_nomor_hp",
    photo: "petugas_profilePhoto",
    id: "petugasId",
  },
};

const DEFAULT_PROFILE = {
  user: {
    name: "User",
    email: "user@example.com",
    phoneNumber: "-",
    profilePhoto: null,
  },
  petugas: {
    name: "Petugas",
    email: "petugas@example.com",
    phoneNumber: "-",
    profilePhoto: null,
  },
};

export const getProfileKeys = (role = "user") => PROFILE_KEYS[role] || PROFILE_KEYS.user;

export const loadStoredProfile = (role = "user") => {
  const keys = getProfileKeys(role);
  const fallbackName = localStorage.getItem("nama");
  const fallbackEmail = localStorage.getItem("email");
  const fallbackPhone = localStorage.getItem("nomor_hp");
  const fallbackId = localStorage.getItem("userId");

  return {
    name:
      localStorage.getItem(keys.name) ||
      fallbackName ||
      DEFAULT_PROFILE[role]?.name ||
      DEFAULT_PROFILE.user.name,
    email:
      localStorage.getItem(keys.email) ||
      fallbackEmail ||
      DEFAULT_PROFILE[role]?.email ||
      DEFAULT_PROFILE.user.email,
    phoneNumber:
      localStorage.getItem(keys.phone) ||
      fallbackPhone ||
      DEFAULT_PROFILE[role]?.phoneNumber ||
      DEFAULT_PROFILE.user.phoneNumber,
    profilePhoto:
      localStorage.getItem(keys.photo) ||
      DEFAULT_PROFILE[role]?.profilePhoto ||
      null,
    id:
      localStorage.getItem(keys.id) ||
      fallbackId ||
      null,
  };
};

export const saveProfile = (role = "user", { name, email, phoneNumber, profilePhoto, id }) => {
  const keys = getProfileKeys(role);
  if (name !== undefined && name !== null) {
    localStorage.setItem(keys.name, name);
    localStorage.setItem("nama", name);
  }
  if (email !== undefined && email !== null) {
    localStorage.setItem(keys.email, email);
    localStorage.setItem("email", email);
  }
  if (phoneNumber !== undefined && phoneNumber !== null) {
    localStorage.setItem(keys.phone, phoneNumber);
    localStorage.setItem("nomor_hp", phoneNumber);
  }
  if (profilePhoto !== undefined) {
    if (profilePhoto !== null) {
      localStorage.setItem(keys.photo, profilePhoto);
    } else {
      localStorage.removeItem(keys.photo);
    }
  }
  if (id !== undefined) {
    if (id !== null) {
      localStorage.setItem(keys.id, String(id));
      localStorage.setItem("userId", String(id));
    } else {
      localStorage.removeItem(keys.id);
      localStorage.removeItem("userId");
    }
  }
};

export const loadProfileFromOrder = (order, role = "user") => {
  if (!order) return null;

  if (role === "user") {
    return {
      name:
        order.user_name ||
        order.nama_user ||
        order.userNama ||
        order.user_name ||
        order.user ||
        (order.user_id ? `User #${order.user_id}` : null),
      email: order.user_email || order.email || order.userEmail || null,
      phoneNumber:
        order.user_phone ||
        order.user_hp ||
        order.nomor_hp ||
        order.user_phone_number ||
        null,
      profilePhoto:
        order.user_photo ||
        order.user_profile_photo ||
        order.profilePhoto ||
        null,
      id: order.user_id || null,
    };
  }

  if (role === "petugas") {
    return {
      name:
        order.driver_name ||
        order.petugas_name ||
        order.petugas_nama ||
        order.driver_nama ||
        (order.driver_id ? `Petugas #${order.driver_id}` : null),
      email: order.driver_email || order.petugas_email || null,
      phoneNumber:
        order.driver_phone ||
        order.driver_hp ||
        order.petugas_nomor_hp ||
        null,
      profilePhoto:
        order.driver_photo ||
        order.driver_profile_photo ||
        order.petugas_photo ||
        order.petugas_profile_photo ||
        null,
      id: order.driver_id || null,
    };
  }

  return null;
};

export const getProfile = (role = "user", order = null) => {
  const orderProfile = loadProfileFromOrder(order, role);
  const storedProfile = loadStoredProfile(role);
  if (orderProfile && orderProfile.name) {
    return {
      name: orderProfile.name,
      email: orderProfile.email || storedProfile.email,
      phoneNumber: orderProfile.phoneNumber || storedProfile.phoneNumber,
      profilePhoto: orderProfile.profilePhoto || storedProfile.profilePhoto,
      id: orderProfile.id || storedProfile.id,
    };
  }
  return storedProfile;
};
