import api from '../utils/axios'

async function logOut() {
  try {
    const { data } = await api.get("/api/auth/logout");
    return data;
  } finally {
    localStorage.removeItem("cortex_session_token");
  }
}

export default logOut;
