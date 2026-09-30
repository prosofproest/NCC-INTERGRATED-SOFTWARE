"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import type { CategoryDefinition, FieldDefinition, FieldType } from "@/types/fields";

export default function AdminDataStructurePage() {
  const [activeTab, setActiveTab] = useState<"categories" | "fields">("categories");

  // Data States
  const [categories, setCategories] = useState<CategoryDefinition[]>([]);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Field Filter
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");

  // Category Modals State
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryDefinition | null>(null);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catSortOrder, setCatSortOrder] = useState(0);
  const [catSaving, setCatSaving] = useState(false);

  // Field Modals State
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);
  const [fieldCategoryId, setFieldCategoryId] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [fieldOptions, setFieldOptions] = useState("");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldMin, setFieldMin] = useState<string>("");
  const [fieldMax, setFieldMax] = useState<string>("");
  const [fieldCadetEditable, setFieldCadetEditable] = useState(true);
  const [fieldCtoVisible, setFieldCtoVisible] = useState(true);
  const [fieldCtoExportable, setFieldCtoExportable] = useState(true);
  const [fieldSortOrder, setFieldSortOrder] = useState(0);
  const [fieldActive, setFieldActive] = useState(true);
  const [fieldSaving, setFieldSaving] = useState(false);

  const fetchStructureData = useCallback(async () => {
    const [catRes, fieldRes] = await Promise.all([
      fetch("/api/admin/categories"),
      fetch("/api/admin/fields"),
    ]);

    if (!catRes.ok || !fieldRes.ok) {
      throw new Error("Failed to load data structure configuration.");
    }

    const catData = await catRes.json();
    const fieldData = await fieldRes.json();

    return {
      categories: catData.categories || [],
      fields: fieldData.fields || [],
    };
  }, []);

  const refreshData = async () => {
    try {
      const data = await fetchStructureData();
      setCategories(data.categories);
      setFields(data.fields);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error refreshing data.");
    }
  };

  useEffect(() => {
    let ignore = false;

    fetchStructureData()
      .then((data) => {
        if (!ignore) {
          setCategories(data.categories);
          setFields(data.fields);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Error loading data structure.");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [fetchStructureData]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // ==========================================
  // CATEGORY HANDLERS
  // ==========================================
  const openCreateCatModal = () => {
    setEditingCategory(null);
    setCatName("");
    setCatDesc("");
    setCatSortOrder((categories.length + 1) * 10);
    setIsCatModalOpen(true);
  };

  const openEditCatModal = (cat: CategoryDefinition) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatDesc(cat.description || "");
    setCatSortOrder(cat.sortOrder || 0);
    setIsCatModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCatSaving(true);
      setError(null);

      if (editingCategory) {
        // Update
        const res = await fetch("/api/admin/categories", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: editingCategory.categoryId,
            name: catName,
            description: catDesc,
            sortOrder: Number(catSortOrder),
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update category");
        }

        showSuccess(`Category '${catName}' updated successfully.`);
      } else {
        // Create
        const res = await fetch("/api/admin/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: catName,
            description: catDesc,
            sortOrder: Number(catSortOrder),
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create category");
        }

        showSuccess(`Category '${catName}' created successfully.`);
      }

      setIsCatModalOpen(false);
      await refreshData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving category");
    } finally {
      setCatSaving(false);
    }
  };

  const handleToggleCategoryActive = async (cat: CategoryDefinition) => {
    if (cat.isSystem) {
      setError("System core categories cannot be deactivated.");
      return;
    }

    try {
      setError(null);
      const res = await fetch("/api/admin/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: cat.categoryId,
          isActive: !cat.isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to toggle category status");
      }

      showSuccess(`Category '${cat.name}' ${cat.isActive ? "deactivated" : "activated"}.`);
      await refreshData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error updating category status");
    }
  };

  // ==========================================
  // FIELD HANDLERS
  // ==========================================
  const openCreateFieldModal = () => {
    setEditingField(null);
    setFieldCategoryId(categories[0]?.categoryId || "");
    setFieldLabel("");
    setFieldType("text");
    setFieldOptions("");
    setFieldRequired(false);
    setFieldMin("");
    setFieldMax("");
    setFieldCadetEditable(true);
    setFieldCtoVisible(true);
    setFieldCtoExportable(true);
    setFieldSortOrder((fields.length + 1) * 10);
    setFieldActive(true);
    setIsFieldModalOpen(true);
  };

  const openEditFieldModal = (field: FieldDefinition) => {
    setEditingField(field);
    setFieldCategoryId(field.categoryId);
    setFieldLabel(field.label);
    setFieldType(field.type);
    setFieldOptions(field.options ? field.options.join(", ") : "");
    setFieldRequired(Boolean(field.validation?.required));
    setFieldMin(field.validation?.min !== undefined ? String(field.validation.min) : "");
    setFieldMax(field.validation?.max !== undefined ? String(field.validation.max) : "");
    setFieldCadetEditable(Boolean(field.permissions?.cadetEditable));
    setFieldCtoVisible(Boolean(field.permissions?.ctoVisible));
    setFieldCtoExportable(Boolean(field.permissions?.ctoExportable));
    setFieldSortOrder(field.sortOrder || 0);
    setFieldActive(field.isActive);
    setIsFieldModalOpen(true);
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFieldSaving(true);
      setError(null);

      const parsedOptions =
        fieldType === "select" || fieldType === "multiselect"
          ? fieldOptions
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

      const validation = {
        required: fieldRequired,
        ...(fieldMin !== "" ? { min: Number(fieldMin) } : {}),
        ...(fieldMax !== "" ? { max: Number(fieldMax) } : {}),
      };

      const permissions = {
        cadetEditable: fieldCadetEditable,
        ctoVisible: fieldCtoVisible,
        ctoExportable: fieldCtoExportable,
      };

      if (editingField) {
        // Update
        const res = await fetch("/api/admin/fields", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fieldId: editingField.fieldId,
            label: fieldLabel,
            options: parsedOptions,
            validation,
            permissions,
            sortOrder: Number(fieldSortOrder),
            isActive: fieldActive,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update dynamic field");
        }

        showSuccess(`Field '${fieldLabel}' updated successfully.`);
      } else {
        // Create
        const res = await fetch("/api/admin/fields", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: fieldCategoryId,
            label: fieldLabel,
            type: fieldType,
            options: parsedOptions,
            validation,
            permissions,
            sortOrder: Number(fieldSortOrder),
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create dynamic field");
        }

        showSuccess(`Field '${fieldLabel}' created successfully.`);
      }

      setIsFieldModalOpen(false);
      await refreshData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving field");
    } finally {
      setFieldSaving(false);
    }
  };

  const handleToggleFieldActive = async (field: FieldDefinition) => {
    try {
      setError(null);
      const res = await fetch("/api/admin/fields", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldId: field.fieldId,
          isActive: !field.isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to toggle field status");
      }

      showSuccess(`Field '${field.label}' ${field.isActive ? "deactivated" : "activated"}.`);
      await refreshData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error updating field status");
    }
  };

  const filteredFields =
    selectedCategoryFilter === "all"
      ? fields
      : fields.filter((f) => f.categoryId === selectedCategoryFilter);

  const getCategoryName = (catId: string) => {
    const cat = categories.find((c) => c.categoryId === catId);
    return cat ? cat.name : catId;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Data Structure Configuration
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure profile categories, dynamic fields, validation constraints, and granular visibility rules.
          </p>
        </div>

        {/* Action Button depending on tab */}
        <div>
          {activeTab === "categories" ? (
            <Button variant="primary" size="sm" onClick={openCreateCatModal}>
              + Add Category
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={openCreateFieldModal}>
              + Add Dynamic Field
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("categories")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
            activeTab === "categories"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Categories ({categories.length})
        </button>
        <button
          onClick={() => setActiveTab("fields")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
            activeTab === "fields"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Dynamic Fields ({fields.length})
        </button>
      </div>

      {/* Notification Banners */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-800 flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)}>&times;</button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <Card className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
          <svg className="animate-spin h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-xs font-medium">Loading data model...</span>
        </Card>
      ) : activeTab === "categories" ? (
        /* ==============================================================
           TAB 1: CATEGORIES LIST
           ============================================================== */
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Category ID</th>
                    <th className="px-6 py-3.5">Name</th>
                    <th className="px-6 py-3.5">Description</th>
                    <th className="px-6 py-3.5">Order</th>
                    <th className="px-6 py-3.5">Type</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {categories.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-500">
                        <div className="space-y-3">
                          <p className="text-xs">No profile categories defined yet.</p>
                          <Button variant="outline" size="sm" onClick={() => openCreateCatModal()}>
                            Create First Category
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    categories.map((cat) => (
                    <tr key={cat.categoryId} className="hover:bg-slate-50/60">
                      <td className="px-6 py-4 font-mono font-medium text-xs text-slate-900">
                        {cat.categoryId}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {cat.name}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                        {cat.description || "—"}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">
                        {cat.sortOrder}
                      </td>
                      <td className="px-6 py-4">
                        {cat.isSystem ? (
                          <Badge variant="primary" size="sm">
                            System Core
                          </Badge>
                        ) : (
                          <Badge variant="outline" size="sm">
                            Custom
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={cat.isActive ? "success" : "warning"} size="sm">
                          {cat.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditCatModal(cat)}
                            className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                          {!cat.isSystem && (
                            <button
                              onClick={() => handleToggleCategoryActive(cat)}
                              className={`text-xs font-semibold cursor-pointer ${
                                cat.isActive
                                  ? "text-rose-600 hover:text-rose-800"
                                  : "text-emerald-600 hover:text-emerald-800"
                              }`}
                            >
                              {cat.isActive ? "Deactivate" : "Activate"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        /* ==============================================================
           TAB 2: DYNAMIC FIELDS LIST
           ============================================================== */
        <div className="space-y-4">
          {/* Category Filter & Notice */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-100/70 p-4 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-700">
                Filter by Category:
              </span>
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900"
              >
                <option value="all">All Categories ({fields.length} fields)</option>
                {categories.map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-[11px] text-slate-500 max-w-md">
              <span className="font-semibold text-slate-700">Note: </span>
              Fields cannot be hard-deleted to maintain historic cadet data integrity. Deactivate fields instead.
            </div>
          </div>

          {/* Fields Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Field ID</th>
                    <th className="px-6 py-3.5">Label</th>
                    <th className="px-6 py-3.5">Category</th>
                    <th className="px-6 py-3.5">Type</th>
                    <th className="px-6 py-3.5">Required</th>
                    <th className="px-6 py-3.5">Permissions</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredFields.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-500">
                        <div className="space-y-3">
                          <p className="text-xs">No dynamic fields found matching this category filter.</p>
                          <Button variant="outline" size="sm" onClick={() => openCreateFieldModal()}>
                            Add New Field
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredFields.map((field) => (
                    <tr key={field.fieldId} className="hover:bg-slate-50/60">
                      <td className="px-6 py-4 font-mono font-medium text-xs text-slate-900">
                        {field.fieldId}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {field.label}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {getCategoryName(field.categoryId)}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" size="sm">
                          {field.type}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium">
                        {field.validation?.required ? (
                          <span className="text-rose-600 font-semibold">Yes</span>
                        ) : (
                          <span className="text-slate-400">Optional</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              field.permissions?.cadetEditable
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            Cadet: {field.permissions?.cadetEditable ? "Edit" : "CR"}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              field.permissions?.ctoVisible
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            CTO: {field.permissions?.ctoVisible ? "View" : "Hide"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={field.isActive ? "success" : "warning"} size="sm">
                          {field.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditFieldModal(field)}
                            className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleFieldActive(field)}
                            className={`text-xs font-semibold cursor-pointer ${
                              field.isActive
                                ? "text-rose-600 hover:text-rose-800"
                                : "text-emerald-600 hover:text-emerald-800"
                            }`}
                          >
                            {field.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ==============================================================
          MODAL: CREATE / EDIT CATEGORY
          ============================================================== */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title={editingCategory ? `Edit Category: ${editingCategory.name}` : "Create Profile Category"}
        description="Profile categories organize cadet regimental and personal data in clear sections."
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Category Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="e.g. Physical & Medical"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              placeholder="Brief explanation of what information is captured in this category."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sort Order
            </label>
            <input
              type="number"
              value={catSortOrder}
              onChange={(e) => setCatSortOrder(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCatModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={catSaving}>
              {editingCategory ? "Update Category" : "Create Category"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ==============================================================
          MODAL: CREATE / EDIT FIELD
          ============================================================== */}
      <Modal
        isOpen={isFieldModalOpen}
        onClose={() => setIsFieldModalOpen(false)}
        title={editingField ? `Edit Field: ${editingField.label}` : "Create Dynamic Field"}
        description="Configure dynamic data attributes, validation rules, and role-based permissions."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveField} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category Select (disabled if editing) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Parent Category <span className="text-rose-500">*</span>
              </label>
              <select
                disabled={Boolean(editingField)}
                value={fieldCategoryId}
                onChange={(e) => setFieldCategoryId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 disabled:opacity-50"
              >
                {categories.map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Field Label */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Field Label <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)}
                placeholder="e.g. Identification Mark"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900"
              />
            </div>

            {/* Field Type (disabled if editing) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Field Type <span className="text-rose-500">*</span>
              </label>
              <select
                disabled={Boolean(editingField)}
                value={fieldType}
                onChange={(e) => setFieldType(e.target.value as FieldType)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 disabled:opacity-50"
              >
                <option value="text">Text (Single-line)</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="select">Dropdown Select</option>
                <option value="multiselect">Multi-Select</option>
                <option value="boolean">Boolean (Yes/No)</option>
                <option value="textarea">Textarea (Multi-line)</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sort Order
              </label>
              <input
                type="number"
                value={fieldSortOrder}
                onChange={(e) => setFieldSortOrder(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900"
              />
            </div>
          </div>

          {/* Options if select/multiselect */}
          {(fieldType === "select" || fieldType === "multiselect") && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Options (comma-separated) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fieldOptions}
                onChange={(e) => setFieldOptions(e.target.value)}
                placeholder="e.g. A+, A-, B+, B-, O+, O-, AB+, AB-"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900"
              />
            </div>
          )}

          {/* Validation Options */}
          <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
            <span className="text-xs font-bold text-slate-700">Validation Rules</span>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fieldRequired}
                  onChange={(e) => setFieldRequired(e.target.checked)}
                  className="rounded-sm border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Required in profile</span>
              </label>

              {fieldType === "number" && (
                <>
                  <div className="flex items-center gap-1">
                    <span>Min:</span>
                    <input
                      type="number"
                      value={fieldMin}
                      onChange={(e) => setFieldMin(e.target.value)}
                      className="w-16 px-2 py-1 bg-white border rounded text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Max:</span>
                    <input
                      type="number"
                      value={fieldMax}
                      onChange={(e) => setFieldMax(e.target.value)}
                      className="w-16 px-2 py-1 bg-white border rounded text-xs"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Permissions Options */}
          <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
            <span className="text-xs font-bold text-slate-700">
              Role Access &amp; Permissions
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fieldCadetEditable}
                  onChange={(e) => setFieldCadetEditable(e.target.checked)}
                  className="rounded-sm border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Cadet can edit directly</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fieldCtoVisible}
                  onChange={(e) => setFieldCtoVisible(e.target.checked)}
                  className="rounded-sm border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>CTO can view</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fieldCtoExportable}
                  onChange={(e) => setFieldCtoExportable(e.target.checked)}
                  className="rounded-sm border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>CTO can export to Excel</span>
              </label>
            </div>
          </div>

          {editingField && (
            <div className="pt-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={fieldActive}
                  onChange={(e) => setFieldActive(e.target.checked)}
                  className="rounded-sm border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span className="font-semibold text-slate-800">
                  Field is Active (uncheck to soft-deactivate)
                </span>
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsFieldModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={fieldSaving}>
              {editingField ? "Update Field" : "Create Field"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
