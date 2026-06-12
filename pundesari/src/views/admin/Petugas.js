
import React, { useState, useEffect } from "react";
import { usersAPI } from "../../services/api";

// react-bootstrap components
import {
  Button,
  Card,
  Form,
  Container,
  Row,
  Col,
  Table,
  InputGroup,
} from "react-bootstrap";

function User() {

  // data user
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDrivers = async () => {
    try {
      const response = await usersAPI.getUsersByRole('petugas');
      setUsers(response.data.map(user => ({
        id: user.id,
        nama: user.nama,
        email: user.email,
        hp: user.nomor_hp,
        role: user.role,
        status: 'Aktif',
      })));
    } catch (error) {
      console.error('Failed to fetch drivers:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  // tampil / sembunyi form
  const [showForm, setShowForm] = useState(false);

  // form input
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hp, setHp] = useState("");

  // tambah user
  const tambahUser = async () => {
    if (!nama || !email || !password || !hp) {
      alert("Isi semua data!");
      return;
    }

    if (password.length < 6) {
      alert("Password minimal 6 karakter");
      return;
    }

    try {
      const newUser = {
        nama,
        email: email.toLowerCase(),
        password,
        role: 'driver',
        nomor_hp: hp,
      };

      await usersAPI.createUser(newUser);
      await fetchDrivers();

      setNama("");
      setEmail("");
      setPassword("");
      setHp("");
      setShowForm(false);
      alert('Petugas berhasil ditambahkan. Email dan password dapat digunakan untuk login.');
    } catch (error) {
      console.error('Failed to add petugas:', error);
      alert('Gagal menambahkan petugas. Coba lagi.');
    }
  };

  // hapus user
  const hapusUser = async (id) => {
    if (!window.confirm('Yakin ingin menghapus petugas ini?')) return;

    try {
      await usersAPI.deleteUser(id);
      setUsers((prevUsers) => prevUsers.filter((user) => user.id !== id));
    } catch (error) {
      console.error('Failed to delete petugas:', error);
      alert('Gagal menghapus petugas. Coba lagi.');
    }
  };

  return (
    <>
      <Container fluid>

        {/* Header */}
        <Row>
          <Col md="12">
            <Card>
              <Card.Body>

                <Row className="align-items-center">

                  <Col md="8">
                    <h4 className="title">Data Petugas</h4>

                    <p className="card-category">
                      Total petugas = {users.length} orang
                    </p>
                  </Col>

                  <Col md="4" className="text-md-right">

                    <Button
                      variant="success"
                      className="btn-fill"
                      onClick={() => setShowForm(true)}
                    >
                      Tambah Petugas
                    </Button>

                  </Col>

                </Row>

              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* FORM TAMBAH */}
        {showForm && (

          <Row>
            <Col md="12">
              <Card>
                <Card.Body>

                  <h5 className="mb-3">Tambah Petugas</h5>
                  <p className="text-muted">Petugas baru dapat login menggunakan email dan password di bawah ini.</p>

                  <Row>

                    <Col md="3">
                      <Form.Group>
                        <Form.Label>Nama</Form.Label>

                        <Form.Control
                          type="text"
                          placeholder="Masukkan Nama"
                          value={nama}
                          onChange={(e) => setNama(e.target.value)}
                        />
                      </Form.Group>
                    </Col>

                    <Col md="3">
                      <Form.Group>
                        <Form.Label>Email</Form.Label>

                        <Form.Control
                          type="email"
                          placeholder="Masukkan Email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </Form.Group>
                    </Col>

                    <Col md="3">
                      <Form.Group>
                        <Form.Label>Password</Form.Label>

                        <Form.Control
                          type="password"
                          placeholder="Masukkan Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </Form.Group>
                    </Col>

                    <Col md="3">
                      <Form.Group>
                        <Form.Label>No HP</Form.Label>

                        <Form.Control
                          type="text"
                          placeholder="Masukkan No HP"
                          value={hp}
                          onChange={(e) => setHp(e.target.value)}
                        />
                      </Form.Group>
                    </Col>

                  </Row>

                  <Button
                    variant="success"
                    className="mt-3 mr-2"
                    onClick={tambahUser}
                  >
                    Simpan
                  </Button>

                  <Button
                    variant="secondary"
                    className="mt-3"
                    onClick={() => setShowForm(false)}
                  >
                    Batal
                  </Button>

                </Card.Body>
              </Card>
            </Col>
          </Row>

        )}

        {/* Table */}
        <Row>
          <Col md="12">
            <Card>
              <Card.Body>

                <Row className="align-items-center mb-3">

                  <Col md="6" className="mb-2 mb-md-0">
                    <InputGroup>
                      <Form.Control
                        placeholder="Cari User"
                        type="text"
                      />
                    </InputGroup>
                  </Col>

                  <Col md="6" className="text-md-right">
                    <Button variant="outline-secondary">
                      Filter
                    </Button>
                  </Col>

                </Row>

                <div className="table-responsive">

                  <Table className="table-hover table-striped">

                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Nama</th>
                        <th>Email</th>
                        <th>No HP</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>

                    <tbody>

                      {loading ? (
                        <tr><td colSpan="5" className="text-center">Memuat data...</td></tr>
                      ) : users.length === 0 ? (
                        <tr><td colSpan="5" className="text-center">Data Kosong</td></tr>
                      ) : (
                        users.map((user, index) => (
                          <tr key={user.id}>

                            <td>{user.id}</td>
                            <td>{user.nama}</td>
                            <td>{user.email}</td>
                            <td>{user.hp}</td>
                            <td>{user.status}</td>

                            <td>

                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => hapusUser(user.id)}
                              >
                                Hapus
                              </Button>
                          </td>

                        </tr>
                      ))
                      )}

                    </tbody>

                  </Table>

                </div>

              </Card.Body>
            </Card>
          </Col>
        </Row>

      </Container>
    </>
  );
}

export default User;
