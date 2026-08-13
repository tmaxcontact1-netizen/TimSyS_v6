import React, { useEffect, useRef, useState } from "react";
import CsvImportResult from "./CsvImportResult";
import { reviewRowClass, reviewRowTitle } from "./importQuality";
import Pagination, { rowNumber } from "../components/Pagination";
import useUnsavedChanges from "../components/useUnsavedChanges";

function InventoryWidget({
  inventory,
  onImport,
  onAdd,
  onEdit,
  onWithdraw,
  onReinstate,
  onDelete,
  pagination,
  onPageChange,
  onSearch,
}) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    item_number: "",
    item_name: "",
    category: "",
    quantity: "",
    location: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const importController = useRef(null);
  useUnsavedChanges(showForm);

  const filtered = inventory || [];
  useEffect(() => {
    const timer = setTimeout(() => onSearch?.(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.item_number || !formData.item_name) {
      setSubmitError("Item number and item name are required");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const supportedCategories = [
      "electronics",
      "furniture",
      "equipment",
      "supplies",
      "books",
      "sports",
      "art",
      "science",
      "computers",
      "general",
      "other",
    ];
    const submitData =
      supportedCategories.includes(formData.category) || !formData.category
        ? formData
        : {
            ...formData,
            category: "other",
            custom_fields: JSON.stringify({
              category_label: formData.category,
            }),
          };
    const result = editingId
      ? await onEdit(editingId, submitData)
      : await onAdd(submitData);
    if (result.success) {
      setShowForm(false);
      setEditingId(null);
      setFormData({
        item_number: "",
        item_name: "",
        category: "",
        quantity: "",
        location: "",
      });
    } else {
      setSubmitError(result.error);
    }
    setSubmitting(false);
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) return;
    const fd = new FormData();
    fd.append("csv_file", importFile);
    const controller = new AbortController();
    importController.current = controller;
    try {
      const result = await onImport(fd, controller.signal);
      if (!controller.signal.aborted) {
        setImportResult(result);
        if (result.success) setImportFile(null);
      }
    } finally {
      if (importController.current === controller)
        importController.current = null;
    }
  };

  const handleEditClick = (item) => {
    setEditingId(item.id);
    setFormData({
      item_number: item.item_number || "",
      item_name: item.item_name || "",
      category: item.category || "",
      quantity: item.quantity || "",
      location: item.location || "",
    });
    setShowForm(true);
  };

  const openAddForm = () => {
    setEditingId(null);
    setFormData({
      item_number: "",
      item_name: "",
      category: "",
      quantity: "",
      location: "",
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setSubmitError(null);
  };
  const cancelImport = () => {
    importController.current?.abort();
    setShowImport(false);
    setImportFile(null);
    setImportResult(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Inventory</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImport(true)}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm"
          >
            Import CSV
          </button>
          <button
            onClick={openAddForm}
            className="bg-timsys-primary hover:bg-timsys-secondary text-white px-4 py-2 rounded text-sm"
          >
            + Add Item
          </button>
        </div>
      </div>

      {showImport && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">
            Import Inventory (CSV)
          </h3>
          <form onSubmit={handleImportSubmit}>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setImportFile(e.target.files[0])}
              className="mb-3 text-gray-400"
            />
            <p className="text-gray-500 text-xs mb-4">
              Required columns: item_name, category, quantity, location
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={cancelImport}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-timsys-primary hover:bg-timsys-secondary text-white px-4 py-2 rounded text-sm"
              >
                Upload
              </button>
            </div>
          </form>
          <CsvImportResult result={importResult} />
        </div>
      )}

      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">
            {editingId ? "Edit Item" : "New Item"}
          </h3>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-gray-400 text-xs mb-1">
                Item Number *
              </label>
              <input
                type="text"
                value={formData.item_number}
                onChange={(e) =>
                  setFormData({ ...formData, item_number: e.target.value })
                }
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary"
                required
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">
                Item Name *
              </label>
              <input
                type="text"
                value={formData.item_name}
                onChange={(e) =>
                  setFormData({ ...formData, item_name: e.target.value })
                }
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary"
                required
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">
                Quantity
              </label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: e.target.value })
                }
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-timsys-primary"
              />
            </div>
            {submitError && (
              <div className="col-span-1 md:col-span-2 bg-red-900/50 border border-red-500 text-red-200 px-3 py-2 rounded text-sm">
                {submitError}
              </div>
            )}
            <div className="col-span-1 md:col-span-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelForm}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-timsys-primary hover:bg-timsys-secondary text-white px-4 py-2 rounded text-sm"
                disabled={submitting}
              >
                {submitting
                  ? "Saving..."
                  : editingId
                    ? "Save Changes"
                    : "Add Item"}
              </button>
            </div>
          </form>
        </div>
      )}

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search inventory..."
        className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-white mb-4 focus:outline-none focus:border-timsys-primary"
      />
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="w-16 text-left px-4 py-3 text-gray-500 text-sm font-medium">
                #
              </th>
              <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">
                Name
              </th>
              <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">
                Category
              </th>
              <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">
                Qty
              </th>
              <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">
                Location
              </th>
              <th className="text-right px-4 py-3 text-gray-400 text-sm font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i, index) => (
              <tr
                key={i.id}
                className={reviewRowClass(i)}
                title={reviewRowTitle(i)}
              >
                <td className="px-4 py-3 text-gray-500 text-sm tabular-nums">
                  {rowNumber(pagination?.page || 1, index)}
                </td>
                <td className="px-4 py-3 text-white text-sm">{i.item_name}</td>
                <td className="px-4 py-3 text-gray-400 text-sm">
                  {i.category || "—"}
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">
                  {i.quantity || "0"}
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">
                  {i.location || "—"}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => handleEditClick(i)}
                    className="text-timsys-primary hover:text-white text-sm"
                  >
                    Edit
                  </button>
                  {i.status === "retired" ? (
                    <>
                      <button
                        onClick={() => onReinstate(i.id)}
                        className="text-green-400 hover:text-green-300 text-sm"
                      >
                        Reinstate
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void onDelete(i.id);
                        }}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => onWithdraw(i.id)}
                      className="text-amber-400 hover:text-amber-300 text-sm"
                    >
                      Withdraw
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                  No items found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination {...pagination} onPageChange={onPageChange} />
      </div>
    </div>
  );
}
export default InventoryWidget;
