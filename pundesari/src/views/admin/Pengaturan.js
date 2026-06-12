import React, { useState, useEffect } from "react";
import { usersAPI } from "../../services/api";
// react-bootstrap components
import {
  Button,
  Card,
  Container,
  Row,
  Col,
  Form,
  Alert,
} from "react-bootstrap";

function Notifications() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    const storedName = localStorage.getItem("nama") || "";
    const storedEmail = localStorage.getItem("email") || "";
    const storedPhone = localStorage.getItem("nomor_hp") || "";
    setName(storedName);
    setEmail(storedEmail);
    setPhone(storedPhone);
  }, []);

  const userId = Number(localStorage.getItem("userId")) || null;

  const handleProfileSave = async () => {
    if (!userId) {
      setMessage({ type: "danger", text: "Id pengguna tidak ditemukan. Silakan login ulang." });
      return;
    }

    setSavingProfile(true);
    try {
      await usersAPI.updateUser(userId, {
        nama: name,
        nomor_hp: phone,
      });

      localStorage.setItem("nama", name);
      localStorage.setItem("nomor_hp", phone);
      if (email) localStorage.setItem("email", email);

      setMessage({ type: "success", text: "Profil berhasil disimpan ke database." });
    } catch (error) {
      console.error("Gagal menyimpan profil:", error);
      setMessage({ type: "danger", text: "Terjadi kesalahan saat menyimpan profil." });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSave = async () => {
    if (!userId) {
      setMessage({ type: "danger", text: "Id pengguna tidak ditemukan. Silakan login ulang." });
      return;
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: "danger", text: "Lengkapi semua field password terlebih dahulu." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "danger", text: "Konfirmasi password tidak cocok." });
      return;
    }

    setSavingPassword(true);
    try {
      await usersAPI.updateUser(userId, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({ type: "success", text: "Password berhasil diperbarui." });
    } catch (error) {
      console.error("Gagal memperbarui password:", error);
      const errorText = error?.response?.data?.message || "Terjadi kesalahan saat memperbarui password.";
      setMessage({ type: "danger", text: errorText });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <Container fluid>
        <Row>
          <Col md="12">
            <h3 className="mb-4">Pengaturan</h3>
          </Col>
        </Row>

        {message && (
          <Row>
            <Col md="12">
              <Alert variant={message.type === "success" ? "success" : "danger"}>
                {message.text}
              </Alert>
            </Col>
          </Row>
        )}

        <Row>
          {/* Left Column - Profile */}
          <Col md="6">
            <Card className="card-user">
              <Card.Header>
                <Card.Title as="h5">Profileku</Card.Title>
              </Card.Header>
              <Card.Body>
                <Form>
                  <Form.Group className="mb-3">
                    <Form.Label>Nama Lengkap</Form.Label>
                    <Form.Control
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Masukkan nama lengkap"
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      disabled
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Nomor HP</Form.Label>
                    <Form.Control
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Masukkan nomor HP"
                    />
                  </Form.Group>

                  <div className="mt-4">
                    <Button
                      variant="primary"
                      className="btn-fill"
                      block
                      onClick={handleProfileSave}
                      disabled={savingProfile}
                    >
                      <i className="nc-icon nc-check-2 mr-2"></i>
                      {savingProfile ? "Menyimpan..." : "Simpan Profil"}
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </Col>

          {/* Right Column - Change Password */}
          <Col md="6">
            <Card>
              <Card.Header>
                <Card.Title as="h5">Ubah Password</Card.Title>
              </Card.Header>
              <Card.Body>
                <Form>
                  <Form.Group className="mb-3">
                    <Form.Label>Password Lama</Form.Label>
                    <Form.Control
                      placeholder="Masukkan password lama"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Password Baru</Form.Label>
                    <Form.Control
                      placeholder="Masukkan password baru"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Konfirmasi Password</Form.Label>
                    <Form.Control
                      placeholder="Masukkan konfirmasi password baru"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </Form.Group>

                  <div className="mt-4">
                    <Button
                      variant="primary"
                      className="btn-fill"
                      block
                      onClick={handlePasswordSave}
                      disabled={savingPassword}
                    >
                      <i className="nc-icon nc-check-2 mr-2"></i>
                      {savingPassword ? "Menyimpan..." : "Simpan Perubahan"}
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
}

export default Notifications;
