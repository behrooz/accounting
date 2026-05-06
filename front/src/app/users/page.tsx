"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppUser, createUser, deleteUser, getUsers, updateUser } from "@/lib/auth";

type UserForm = {
  fullName: string;
  username: string;
  password: string;
  role: AppUser["role"];
  isActive: boolean;
};

const initialForm: UserForm = {
  fullName: "",
  username: "",
  password: "",
  role: "staff",
  isActive: true,
};

const roleLabel: Record<AppUser["role"], string> = {
  admin: "مدیر",
  manager: "سرپرست",
  staff: "کارمند",
};

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [form, setForm] = useState<UserForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const allUsers = await getUsers();
      setUsers(allUsers);
    };
    void load();
  }, []);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingId) {
      await updateUser(editingId, {
        id: editingId,
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        password: form.password.trim(),
        role: form.role,
        isActive: form.isActive,
      });
    } else {
      await createUser({
        id: crypto.randomUUID(),
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        password: form.password.trim(),
        role: form.role,
        isActive: form.isActive,
      });
    }
    setUsers(await getUsers());
    resetForm();
  };

  const onEdit = (user: AppUser) => {
    setEditingId(user.id);
    setForm({
      fullName: user.fullName,
      username: user.username,
      password: "",
      role: user.role,
      isActive: user.isActive,
    });
  };

  const onDelete = async (id: string) => {
    await deleteUser(id);
    setUsers(await getUsers());
  };

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#16191f]">مدیریت کاربران</h1>
        <p className="mt-1 text-sm text-[#545b64]">تعریف کاربران مجاز برای ورود به پلتفرم</p>
      </div>

      <form onSubmit={onSubmit} className="rounded border border-[#d5dbdb] bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-[#16191f]">
          {editingId ? "ویرایش کاربر" : "افزودن کاربر جدید"}
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-[#545b64]">نام کامل</span>
            <input
              className="w-full rounded border border-[#aab7b8] px-3 py-2 outline-none ring-[#0073bb] focus:ring"
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-[#545b64]">نام کاربری</span>
            <input
              className="w-full rounded border border-[#aab7b8] px-3 py-2 outline-none ring-[#0073bb] focus:ring"
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-[#545b64]">رمز عبور</span>
            <input
              className="w-full rounded border border-[#aab7b8] px-3 py-2 outline-none ring-[#0073bb] focus:ring"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-[#545b64]">نقش</span>
            <select
              className="w-full rounded border border-[#aab7b8] px-3 py-2 outline-none ring-[#0073bb] focus:ring"
              value={form.role}
              onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as AppUser["role"] }))}
            >
              <option value="admin">مدیر</option>
              <option value="manager">سرپرست</option>
              <option value="staff">کارمند</option>
            </select>
          </label>
        </div>

        <label className="mt-4 inline-flex items-center gap-2 text-sm text-[#545b64]">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
          />
          فعال باشد
        </label>

        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            className="rounded bg-[#0073bb] px-4 py-2 text-sm font-medium text-white hover:bg-[#006499]"
          >
            {editingId ? "ثبت ویرایش" : "افزودن کاربر"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded border border-[#aab7b8] px-4 py-2 text-sm font-medium text-[#16191f] hover:bg-[#f2f3f3]"
            >
              انصراف
            </button>
          )}
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded border border-[#d5dbdb] bg-white shadow-sm">
        <table className="w-full border-collapse">
          <thead className="bg-[#f2f3f3]">
            <tr className="text-right text-sm text-[#545b64]">
              <th className="px-4 py-3">نام</th>
              <th className="px-4 py-3">نام کاربری</th>
              <th className="px-4 py-3">نقش</th>
              <th className="px-4 py-3">وضعیت</th>
              <th className="px-4 py-3">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-[#879596]">
                  کاربری ثبت نشده است.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-t border-[#eaeded] text-sm text-[#16191f]">
                  <td className="px-4 py-3">{user.fullName}</td>
                  <td className="px-4 py-3">{user.username}</td>
                  <td className="px-4 py-3">{roleLabel[user.role]}</td>
                  <td className="px-4 py-3">
                    {user.isActive ? (
                      <span className="rounded bg-[#eef7ee] px-2 py-1 text-xs text-[#1d8102]">فعال</span>
                    ) : (
                      <span className="rounded bg-[#fdf3f1] px-2 py-1 text-xs text-[#d13212]">غیرفعال</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(user)}
                        className="rounded bg-[#ec7211] px-3 py-1.5 text-xs text-white hover:bg-[#eb5f07]"
                      >
                        ویرایش
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(user.id)}
                        className="rounded bg-[#d13212] px-3 py-1.5 text-xs text-white hover:bg-[#b3260d]"
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
