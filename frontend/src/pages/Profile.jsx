import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Wallet,
  Building2,
  Hash,
  Loader2,
  CheckCircle,
  AlertCircle,
  LogOut,
  ArrowLeft,
  Shield,
} from "lucide-react";
import axios from "axios";
import { useAuth } from "../components/AuthContext";

export default function Profile() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState(false);

  // Editable fields
  const [upiId, setUpiId] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [ifscCode, setIfscCode] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("ra_token");
      const res = await axios.get("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(res.data);
      setUpiId(res.data.upiId || "");
      setBankAccount(res.data.bankAccount || "");
      setIfscCode(res.data.ifscCode || "");
    } catch {
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const token = localStorage.getItem("ra_token");
      await axios.post(
        "/api/auth/setup",
        { upiId, bankAccount, ifscCode },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      login({ ...user, setupDone: true });
      setProfile((p) => ({ ...p, upiId, bankAccount, ifscCode }));
      setSuccess("Payment details updated");
      setEditing(false);
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
            <p className="text-sm text-gray-500">
              Manage your account and payment details
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 mb-4">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Account Info Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 bg-violet-100 rounded-full flex items-center justify-center">
            <span className="text-xl font-bold text-violet-600">
              {(profile?.fullName || profile?.email || "U")
                .charAt(0)
                .toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {profile?.fullName || "User"}
            </h2>
            <p className="text-sm text-gray-500">{profile?.email}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg">
            <User className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">
                Full Name
              </p>
              <p className="text-sm font-medium text-gray-800">
                {profile?.fullName || "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg">
            <Mail className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">
                Email
              </p>
              <p className="text-sm font-medium text-gray-800">
                {profile?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg">
            <Shield className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">
                Account Status
              </p>
              <p className="text-sm font-medium text-green-600">
                Active · Setup {profile?.setupDone ? "Complete" : "Pending"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Details Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-violet-600" />
            <h3 className="font-semibold text-gray-900">Payment Details</h3>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-violet-600 hover:text-violet-700 font-medium"
            >
              Edit
            </button>
          )}
        </div>

        {!editing ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg">
              <Wallet className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  UPI ID
                </p>
                <p className="text-sm font-medium text-gray-800">
                  {profile?.upiId || "Not set"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg">
              <Building2 className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Bank Account
                </p>
                <p className="text-sm font-medium text-gray-800">
                  {profile?.bankAccount
                    ? "••••" + profile.bankAccount.slice(-4)
                    : "Not set"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg">
              <Hash className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  IFSC Code
                </p>
                <p className="text-sm font-medium text-gray-800 font-mono">
                  {profile?.ifscCode || "Not set"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                UPI ID
              </label>
              <div className="relative">
                <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="yourname@upi"
                  className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Bank Account Number
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="1234567890"
                  className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                IFSC Code
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="SBIN0001234"
                  maxLength={11}
                  className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent font-mono"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setEditing(false);
                  setUpiId(profile?.upiId || "");
                  setBankAccount(profile?.bankAccount || "");
                  setIfscCode(profile?.ifscCode || "");
                }}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" /> Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
