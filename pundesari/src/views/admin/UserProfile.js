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
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editNama, setEditNama] = useState("");
  const [editHp, setEditHp] = useState("");
  const [editAlamat, setEditAlamat] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await usersAPI.getUsersByRole('user');
      setUsers(response.data.map(u => ({
        id: u.id,
        nama: u.nama,
        nomor_hp: u.nomor_hp || u.hp || '-',
      })));
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <>
      <Container fluid>
        <Row>
          <Col md="12">
            <Card>
              <Card.Body>
                <Row className="align-items-center">
                  <Col md="8">
                    <h4 className="title">Data Costumer</h4>
                    <p className="card-category">Total costumer = {users.length} orang</p>
                  </Col>
                  <Col md="4" className="text-md-right">
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row>
          <Col md="12">
            <Card>
              <Card.Body>
                <Row className="align-items-center mb-3">
                  <Col md="6" className="mb-2 mb-md-0">
                    <InputGroup>
                      <Form.Control placeholder="Cari User" type="text" />
                    </InputGroup>
                  </Col>
                  <Col md="6" className="text-md-right">
                    <Button variant="outline-secondary">Filter</Button>
                  </Col>
                </Row>

                <div className="table-responsive">
                  <Table className="table-hover table-striped">
                    <thead>
                      <tr>
                        <th className="border-0">Kode</th>
                        <th className="border-0">Nama</th>
                        <th className="border-0">No HP</th>
                        <th className="border-0">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan="6" className="text-center">Memuat data...</td></tr>
                      ) : users.length === 0 ? (
                        <tr><td colSpan="6" className="text-center">Data Kosong</td></tr>
                      ) : (
                        users.map((user, index) => (
                          <tr key={user.id}>
                            <td>{user.id}</td>
                            <td>{user.nama}</td>
                            <td>{user.nomor_hp || '-'}</td>
                            <td>

                              <Button variant="danger" size="sm" onClick={async () => {
                                if (!window.confirm('Yakin ingin menghapus user ini?')) return;
                                try {
                                  await usersAPI.deleteUser(user.id);
                                  await fetchUsers();
                                } catch (err) {
                                  console.error('Failed to delete user:', err);
                                  alert('Gagal menghapus user. Coba lagi.');
                                }
                              }}>
                                Hapus
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>
                {/* EDIT FORM */}
                {showEditForm && (
                  <div className="mt-3">
                    <h5>Edit User</h5>
                    <Row>
                      <Col md="4">
                        <Form.Group>
                          <Form.Label>Nama</Form.Label>
                          <Form.Control value={editNama} onChange={(e) => setEditNama(e.target.value)} />
                        </Form.Group>
                      </Col>
                      <Col md="4">
                        <Form.Group>
                          <Form.Label>No HP</Form.Label>
                          <Form.Control value={editHp} onChange={(e) => setEditHp(e.target.value)} />
                        </Form.Group>
                      </Col>
                      <Col md="4">
                        <Form.Group>
                          <Form.Label>Alamat</Form.Label>
                          <Form.Control value={editAlamat} onChange={(e) => setEditAlamat(e.target.value)} />
                        </Form.Group>
                      </Col>
                    </Row>
                    <div className="mt-2">
                      <Button variant="success" className="mr-2" onClick={async () => {
                        if (!editId) return;
                        try {
                          const payload = {
                            nama: editNama,
                            nomor_hp: editHp,
                            alamat: editAlamat,
                          };
                          await usersAPI.updateUser(editId, payload);
                          await fetchUsers();
                          setShowEditForm(false);
                          setEditId(null);
                        } catch (err) {
                          console.error('Failed to update user:', err);
                          alert('Gagal menyimpan perubahan. Coba lagi.');
                        }
                      }}>Simpan</Button>
                      <Button variant="secondary" onClick={() => setShowEditForm(false)}>Batal</Button>
                    </div>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
}

export default User;
