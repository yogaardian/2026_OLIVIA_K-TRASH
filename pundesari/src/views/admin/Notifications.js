import React from "react";
// react-bootstrap components
import {
  Button,
  Card,
  Container,
  Row,
  Col,
  Form,
} from "react-bootstrap";

function Notifications() {
  return (
    <>
      <Container fluid>
        <Row>
          <Col md="12">
            <h3 className="mb-4">Pengaturan</h3>
          </Col>
        </Row>

        <Row>
          {/* Left Column - Profile */}
          <Col md="6">
            <Card className="card-user">
              <Card.Header>
                <Card.Title as="h5">Profileku</Card.Title>
              </Card.Header>
              <Card.Body>
                {/* Profile Section */}
                <div className="text-center mb-4">
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <img
                      alt="profile"
                      className="avatar border-gray"
                      src={require("assets/img/faces/face-3.jpg")}
                      style={{ width: "80px", height: "80px", borderRadius: "50%" }}
                    />
                    <Button
                      variant="link"
                      size="sm"
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        backgroundColor: "white",
                        borderRadius: "50%",
                        padding: "4px 8px",
                      }}
                    >
                      <i className="nc-icon nc-settings-tool-66"></i>
                    </Button>
                  </div>
                  <h5 className="mt-3 mb-1">Asep Admin</h5>
                  <p className="text-muted mb-1">asep.admin99@gmail.com</p>
                  <p className="text-muted">08145901240118</p>
                </div>

                {/* Activity Section */}

                
                <div className="menu-item mb-2" style={{ padding: "12px", borderBottom: "1px solid #eee", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>
                    <i className="nc-icon nc-simple-delete mr-2"></i>
                    Hapus akun
                  </span>
                  <i className="nc-icon nc-stre-right"></i>
                </div>
                <div className="menu-item" style={{ padding: "12px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>
                    <i className="nc-icon nc-button-power mr-2"></i>
                    Keluar
                  </span>
                  <i className="nc-icon nc-stre-right"></i>
                </div>
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
                  <Form.Group>
                    <Form.Label>Password Lama</Form.Label>
                    <Form.Control
                      placeholder="Masukkan password lama"
                      type="password"
                    />
                  </Form.Group>

                  <Form.Group>
                    <Form.Label>Password Baru</Form.Label>
                    <Form.Control
                      placeholder="Masukkan password baru"
                      type="password"
                    />
                  </Form.Group>

                  <Form.Group>
                    <Form.Label>Konfirmasi Password</Form.Label>
                    <Form.Control
                      placeholder="Masukkan konfirmasi password baru"
                      type="password"
                    />
                  </Form.Group>

                  <div className="mt-4">
                    <Button
                      variant="primary"
                      className="btn-fill"
                      block
                    >
                      <i className="nc-icon nc-check-2 mr-2"></i>
                      Simpan Perubahan
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
