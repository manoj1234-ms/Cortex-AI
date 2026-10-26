
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../utils/firebase";
import api from "../utils/axios";
import { FcGoogle } from "react-icons/fc";
import {useDispatch, useSelector} from 'react-redux'
import { setUserData } from "../redux/userSlice";
import Sidebar from "../components/Sidebar";
import ChatArea from './../components/ChatArea';
import Artifact from "../components/Artifact";



function Home() {
  const {userData} =  useSelector(state=> state.user)
  const dispatch = useDispatch()

  const handleLogin = async (token) => {
    try {
      const { data } = await api.post("/api/auth/login", { token });

      if (data.sessionId) {
        localStorage.setItem("cortex_session_token", data.sessionId);
      }

      dispatch(setUserData(data.user));
    } catch (error) {
      console.error(
        "Backend login failed:",
        error.response?.data || error.message
      );
    }
  };

  const googlelogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const token = await result.user.getIdToken();

      console.log("Firebase login successful:", result.user);
      await handleLogin(token);
    } catch (error) {
      console.error("Google login failed:", error.message);
    }
  };

  return (
    <div className="h-screen  flex bg-[#0d0f14] text-white overflow-hidden">

      <Sidebar/>
      <ChatArea/>
      <Artifact/>
{!userData && 
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="w-[340px] bg-[#13151c] border border-white/[0.08] rounded-2xl flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-[17px] font-semibold text-slate-100 tracking-tight">
              Welcome to ConvexAI
            </h2>

            <p className="text-[13px] text-slate-500">
              Please log in to continue using the app.
            </p>
          </div>

          <button
            type="button"
            onClick={googlelogin}
            className="w-full flex items-center justify-center gap-3 py-[11px] rounded-xl
              text-sm font-medium text-white bg-linear-to-br from-indigo-500 to-violet-700
              hover:from-indigo-400 hover:to-violet-600
              active:from-indigo-600 active:to-violet-800
              border border-indigo-500/30 shadow-lg shadow-indigo-500/20
              hover:shadow-indigo-500/30 transition-all duration-150 cursor-pointer"
          >
            <FcGoogle size={18} />
            Continue with Google
          </button>
        </div>
      </div>
}

    </div>
  );
}

export default Home;
