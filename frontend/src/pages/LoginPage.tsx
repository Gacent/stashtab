import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await api.login(password);
      localStorage.setItem("auth_token", res.token);
      navigate("/");
    } catch {
      setError("密码错误");
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <form onSubmit={handleLogin} className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl">🔖</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">收藏夹</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">请输入访问密码</p>
        </div>

        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="密码"
          autoFocus
          className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-gray-50 dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-center"
        />

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading || !password.trim()}
          className="w-full py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-blue-600 transition-colors"
        >
          {loading ? "验证中..." : "进入"}
        </button>
      </form>
    </div>
  );
}