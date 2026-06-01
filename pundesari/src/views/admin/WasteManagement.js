import React, { useEffect, useState } from "react";
import { Card, Container, Row, Col, Button, Form, Table } from "react-bootstrap";
import { useNotification } from "../../context/NotificationContext";
import { wasteAPI } from "../../services/api";
import Pagination from "../../components/ui/Pagination";
import SearchInput from "../../components/ui/SearchInput";
import LoadingSkeleton from "../../components/ui/LoadingSkeleton";
import EmptyState from "../../components/ui/EmptyState";

const PAGE_LIMIT = 10;
const initialCategoryForm = { id: "", nama_kategori: "", deskripsi: "" };
const initialTypeForm = { id: "", kategori_id: "", nama_jenis: "", harga_per_kg: "" };

function WasteManagement() {
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catPage, setCatPage] = useState(1);
  const [catTotal, setCatTotal] = useState(0);
  const [catSearch, setCatSearch] = useState("");
  const [categoryForm, setCategoryForm] = useState(initialCategoryForm);
  const [isEditingCategory, setIsEditingCategory] = useState(false);

  const [types, setTypes] = useState([]);
  const [typeLoading, setTypeLoading] = useState(true);
  const [typePage, setTypePage] = useState(1);
  const [typeTotal, setTypeTotal] = useState(0);
  const [typeSearch, setTypeSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [typeForm, setTypeForm] = useState(initialTypeForm);
  const [isEditingType, setIsEditingType] = useState(false);

  const { success, error } = useNotification();

  const loadCategories = async () => {
    setCatLoading(true);
    try {
      const response = await wasteAPI.listCategories({
        page: catPage,
        limit: PAGE_LIMIT,
        search: catSearch,
      });

      const data = response.data.data || [];
      setCategories(data);
      setCatTotal(response.data.pagination?.totalData || 0);

      if (!selectedCategoryId && data.length > 0) {
        setSelectedCategoryId(String(data[0].id));
      }
    } catch (err) {
      console.error("Gagal mengambil kategori:", err);
      error("Gagal mengambil kategori sampah");
    } finally {
      setCatLoading(false);
    }
  };

  const loadTypes = async (categoryId) => {
    setTypeLoading(true);
    try {
      if (!categoryId) {
        setTypes([]);
        setTypeTotal(0);
        return;
      }

      const response = await wasteAPI.listWasteTypesByCategory(categoryId, {
        page: typePage,
        limit: PAGE_LIMIT,
        search: typeSearch,
      });

      setTypes(response.data.data || []);
      setTypeTotal(response.data.pagination?.totalData || 0);
    } catch (err) {
      console.error("Gagal mengambil jenis sampah:", err);
      error("Gagal mengambil jenis sampah");
    } finally {
      setTypeLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [catPage, catSearch]);

  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(String(categories[0].id));
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    if (selectedCategoryId) {
      loadTypes(Number(selectedCategoryId));
    } else {
      setTypes([]);
    }
  }, [selectedCategoryId, typePage, typeSearch]);

  const resetCategoryForm = () => {
    setCategoryForm(initialCategoryForm);
    setIsEditingCategory(false);
  };

  const resetTypeForm = () => {
    setTypeForm(initialTypeForm);
    setIsEditingType(false);
  };

  const handleSaveCategory = async (event) => {
    event?.preventDefault();

    const payload = {
      nama_kategori: categoryForm.nama_kategori.trim(),
      deskripsi: categoryForm.deskripsi.trim(),
    };

    if (!payload.nama_kategori) {
      return error("Nama kategori wajib diisi");
    }

    try {
      if (isEditingCategory && categoryForm.id) {
        await wasteAPI.updateCategory(categoryForm.id, payload);
        success("Kategori berhasil diperbarui");
      } else {
        await wasteAPI.createCategory(payload);
        success("Kategori berhasil ditambahkan");
      }

      resetCategoryForm();
      loadCategories();
    } catch (err) {
      console.error("Kategori save error:", err);
      if (err.response?.data?.message) {
        error(err.response.data.message);
      } else {
        error("Gagal menyimpan kategori");
      }
    }
  };

  const handleSaveType = async (event) => {
    event?.preventDefault();

    const payload = {
      kategori_id: Number(typeForm.kategori_id || selectedCategoryId),
      nama_jenis: typeForm.nama_jenis.trim(),
      harga_per_kg: Number(typeForm.harga_per_kg),
    };

    if (!payload.kategori_id) {
      return error("Kategori wajib dipilih");
    }
    if (!payload.nama_jenis) {
      return error("Nama jenis sampah wajib diisi");
    }
    if (!Number.isFinite(payload.harga_per_kg) || payload.harga_per_kg <= 0) {
      return error("Harga per Kg harus angka positif");
    }

    try {
      if (isEditingType && typeForm.id) {
        await wasteAPI.updateWasteType(typeForm.id, payload);
        success("Jenis sampah berhasil diperbarui");
      } else {
        await wasteAPI.createWasteType(payload);
        success("Jenis sampah berhasil ditambahkan");
      }

      resetTypeForm();
      loadTypes(payload.kategori_id);
    } catch (err) {
      console.error("Jenis save error:", err);
      if (err.response?.data?.message) {
        error(err.response.data.message);
      } else {
        error("Gagal menyimpan jenis sampah");
      }
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm("Yakin ingin menghapus kategori ini?")) return;

    try {
      await wasteAPI.deleteCategory(categoryId);
      success("Kategori berhasil dihapus");
      setSelectedCategoryId("");
      resetTypeForm();
      loadCategories();
    } catch (err) {
      console.error("Kategori delete error:", err);
      error(err.response?.data?.message || "Gagal menghapus kategori");
    }
  };

  const handleDeleteType = async (typeId) => {
    if (!window.confirm("Yakin ingin menghapus jenis sampah ini?")) return;

    try {
      await wasteAPI.deleteWasteType(typeId);
      success("Jenis sampah berhasil dihapus");
      loadTypes(Number(selectedCategoryId));
    } catch (err) {
      console.error("Jenis delete error:", err);
      error(err.response?.data?.message || "Gagal menghapus jenis sampah");
    }
  };

  const handleEditCategory = (item) => {
    setCategoryForm({
      id: item.id,
      nama_kategori: item.nama_kategori,
      deskripsi: item.deskripsi || "",
    });
    setIsEditingCategory(true);
  };

  const handleEditType = (item) => {
    setTypeForm({
      id: item.id,
      kategori_id: String(item.kategori_id),
      nama_jenis: item.nama_jenis,
      harga_per_kg: String(item.harga_per_kg),
    });
    setSelectedCategoryId(String(item.kategori_id));
    setIsEditingType(true);
  };

  return (
    <>
      <Container fluid>
        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Header>
                <Card.Title as="h4">Master Kategori Sampah</Card.Title>
                <p className="card-category">Kelola kategori sampah secara dinamis.</p>
              </Card.Header>

              <Card.Body>
                <Row className="mb-3">
                  <Col md={6}>
                    <SearchInput
                      value={catSearch}
                      onChange={(value) => {
                        setCatSearch(value);
                        setCatPage(1);
                      }}
                      placeholder="Cari kategori..."
                      disabled={catLoading}
                    />
                  </Col>
                </Row>

                <Row>
                  <Col lg={8}>
                    {catLoading ? (
                      <LoadingSkeleton rows={5} />
                    ) : categories.length === 0 ? (
                      <EmptyState message="Belum ada kategori" />
                    ) : (
                      <>
                        <Table responsive hover className="text-nowrap">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Nama Kategori</th>
                              <th>Deskripsi</th>
                              <th className="text-end">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {categories.map((category) => (
                              <tr key={category.id}>
                                <td>{category.id}</td>
                                <td>{category.nama_kategori}</td>
                                <td>{category.deskripsi || '-'}</td>
                                <td className="text-end">
                                  <Button size="sm" variant="warning" className="me-2" onClick={() => handleEditCategory(category)}>
                                    Edit
                                  </Button>
                                  <Button size="sm" variant="danger" onClick={() => handleDeleteCategory(category.id)}>
                                    Hapus
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>

                        <Pagination
                          page={catPage}
                          totalPages={Math.ceil(catTotal / PAGE_LIMIT)}
                          onPageChange={(nextPage) => setCatPage(nextPage)}
                          disabled={catLoading}
                        />
                      </>
                    )}
                  </Col>

                  <Col lg={4}>
                    <Card className="shadow-sm">
                      <Card.Body>
                        <Card.Title>{isEditingCategory ? 'Edit Kategori' : 'Tambah Kategori'}</Card.Title>
                        <Form onSubmit={handleSaveCategory}>
                          <Form.Group className="mb-3" controlId="categoryName">
                            <Form.Label>Nama Kategori</Form.Label>
                            <Form.Control
                              type="text"
                              value={categoryForm.nama_kategori}
                              onChange={(e) => setCategoryForm({ ...categoryForm, nama_kategori: e.target.value })}
                              placeholder="Contoh: Plastik"
                            />
                          </Form.Group>
                          <Form.Group className="mb-3" controlId="categoryDescription">
                            <Form.Label>Deskripsi</Form.Label>
                            <Form.Control
                              as="textarea"
                              rows={3}
                              value={categoryForm.deskripsi}
                              onChange={(e) => setCategoryForm({ ...categoryForm, deskripsi: e.target.value })}
                              placeholder="Deskripsi singkat kategori"
                            />
                          </Form.Group>
                          <div className="d-grid gap-2">
                            <Button type="submit" variant="primary">
                              {isEditingCategory ? 'Update Kategori' : 'Simpan Kategori'}
                            </Button>
                            {isEditingCategory && (
                              <Button variant="secondary" onClick={resetCategoryForm}>
                                Batal
                              </Button>
                            )}
                          </div>
                        </Form>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row>
          <Col>
            <Card>
              <Card.Header>
                <Card.Title as="h4">Master Jenis Sampah</Card.Title>
                <p className="card-category">Kelola jenis sampah dan harga per kg.</p>
              </Card.Header>

              <Card.Body>
                <Row className="mb-3">
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Kategori</Form.Label>
                      <Form.Select
                        value={selectedCategoryId}
                        onChange={(e) => {
                          setSelectedCategoryId(e.target.value);
                          setTypePage(1);
                        }}
                        disabled={catLoading}
                      >
                        <option value="">Pilih kategori</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.nama_kategori}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <SearchInput
                      value={typeSearch}
                      onChange={(value) => {
                        setTypeSearch(value);
                        setTypePage(1);
                      }}
                      placeholder="Cari jenis sampah..."
                      disabled={typeLoading}
                    />
                  </Col>
                </Row>

                <Row>
                  <Col lg={8}>
                    {typeLoading ? (
                      <LoadingSkeleton rows={5} />
                    ) : !selectedCategoryId ? (
                      <EmptyState message="Pilih kategori untuk melihat jenis sampah." />
                    ) : types.length === 0 ? (
                      <EmptyState message="Tidak ada jenis sampah untuk kategori ini." />
                    ) : (
                      <>
                        <Table responsive hover className="text-nowrap">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Kategori</th>
                              <th>Nama Jenis Sampah</th>
                              <th>Harga / Kg</th>
                              <th className="text-end">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {types.map((item) => (
                              <tr key={item.id}>
                                <td>{item.id}</td>
                                <td>{item.kategori}</td>
                                <td>{item.nama_jenis}</td>
                                <td>Rp {Number(item.harga_per_kg).toLocaleString()}</td>
                                <td className="text-end">
                                  <Button size="sm" variant="warning" className="me-2" onClick={() => handleEditType(item)}>
                                    Edit
                                  </Button>
                                  <Button size="sm" variant="danger" onClick={() => handleDeleteType(item.id)}>
                                    Hapus
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>

                        <Pagination
                          page={typePage}
                          totalPages={Math.ceil(typeTotal / PAGE_LIMIT)}
                          onPageChange={(nextPage) => setTypePage(nextPage)}
                          disabled={typeLoading}
                        />
                      </>
                    )}
                  </Col>

                  <Col lg={4}>
                    <Card className="shadow-sm">
                      <Card.Body>
                        <Card.Title>{isEditingType ? 'Edit Jenis Sampah' : 'Tambah Jenis Sampah'}</Card.Title>
                        <Form onSubmit={handleSaveType}>
                          <Form.Group className="mb-3" controlId="formTypeCategory">
                            <Form.Label>Kategori</Form.Label>
                            <Form.Select
                              value={typeForm.kategori_id || selectedCategoryId}
                              onChange={(e) => setTypeForm({ ...typeForm, kategori_id: e.target.value })}
                              disabled={catLoading}
                            >
                              <option value="">Pilih kategori</option>
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.nama_kategori}
                                </option>
                              ))}
                            </Form.Select>
                          </Form.Group>

                          <Form.Group className="mb-3" controlId="formTypeName">
                            <Form.Label>Nama Jenis Sampah</Form.Label>
                            <Form.Control
                              type="text"
                              value={typeForm.nama_jenis}
                              onChange={(e) => setTypeForm({ ...typeForm, nama_jenis: e.target.value })}
                              placeholder="Contoh: Botol Plastik"
                            />
                          </Form.Group>

                          <Form.Group className="mb-3" controlId="formTypePrice">
                            <Form.Label>Harga per Kg</Form.Label>
                            <Form.Control
                              type="number"
                              value={typeForm.harga_per_kg}
                              onChange={(e) => setTypeForm({ ...typeForm, harga_per_kg: e.target.value })}
                              placeholder="Contoh: 3000"
                            />
                          </Form.Group>

                          <div className="d-grid gap-2">
                            <Button type="submit" variant="primary">
                              {isEditingType ? 'Update Jenis' : 'Simpan Jenis'}
                            </Button>
                            {isEditingType && (
                              <Button variant="secondary" onClick={resetTypeForm}>
                                Batal
                              </Button>
                            )}
                          </div>
                        </Form>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
}

export default WasteManagement;
