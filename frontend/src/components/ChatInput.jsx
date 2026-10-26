import { useEffect, useRef, useState } from 'react';
import { Bug, Code2, FileText, Globe, ImageIcon, MessageSquare, Mic, MicOff, Paperclip, Presentation, Send, X, Zap } from 'lucide-react';
import sendMessage from './../features/sendMessage';
import { useDispatch, useSelector } from 'react-redux';
import { createConversation } from './../features/createConversation';
import { addConversation, setConvTitle, setSelectedConversation } from './../redux/conversationSlice';
import { addMessage, setArtifacts, setIsLoading } from '../redux/messageSlice';
import { updateConversation } from './../features/updateConversation';
import api from '../utils/axios';
import { setUserData } from '../redux/userSlice';

function ChatInput() {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const dispatch = useDispatch();
  const [selectedAgent, setSelectedAgent] = useState("Auto")
  const [selectedFile, setSelectedFile] = useState(null)
  const [listen , setListen] = useState(false)
  const recognitionRef = useRef(null)

useEffect(() => {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    setError("Speech recognition is not supported in this browser.");
    return;
  }

  const recognition = new SpeechRecognition();

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-IN";

  recognition.onresult = (event) => {
    let transcript = "";

    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }

    setValue(transcript);
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    setListen(false);
  };

  recognition.onend = () => {
    setListen(false);
  };

  recognitionRef.current = recognition;

  return () => {
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.abort();
    recognitionRef.current = null;
  };
}, []);

const toggleMic = () => {
  const recognition = recognitionRef.current;

  if (!recognition) {
    setError("Speech recognition is unavailable. Try Google Chrome.");
    return;
  }

  setError("");

  if (listen) {
    recognition.stop();
    setListen(false);
  } else {
    try {
      recognition.start();
      setListen(true);
    } catch (error) {
      console.error("Unable to start speech recognition:", error);
      setError("Could not start the microphone. Please try again.");
    }
  }
};


  const fileRef = useRef(null)
  const { selectedConversation } = useSelector(
    state => state.conversation
  );

  const handleSendMessage = async () => {
    const prompt = value.trim();
    if (!prompt || isSending) return;

    setError('');
    setIsSending(true);

    try {
      dispatch(setIsLoading(true))
      let conversation = selectedConversation;

      if (!conversation?._id) {
        const conv = await createConversation();
        dispatch(setSelectedConversation(conv));
        dispatch(addConversation(conv));
        conversation = conv;
      }

      if (conversation.title === "New Chat") {
        await updateConversation({ id: conversation._id, title: prompt });
        dispatch(setConvTitle({ conversationId: conversation._id, title: prompt }));
      }

      // const payload = {
      //   prompt,
      //   conversationId: conversation?._id,
      //   agent: selectedAgent.toLowerCase()
      // };

      const formData = new FormData()
      formData.append("prompt", value.trim())
      formData.append("conversationId", conversation?._id)
      formData.append("agent", selectedAgent.toLowerCase())
      formData.append("file", selectedFile)

      // console.log(selectedFile)

      dispatch(addMessage({ role: "user", content: prompt }));
      setValue("");

      const data = await sendMessage(formData);
      if (typeof data?.answer !== "string" || !data.answer.trim()) {
        throw new Error("The assistant returned an empty response.");
      }

      dispatch(setIsLoading(false))

      setSelectedFile(null)

      dispatch(setArtifacts(data.artifacts || []))

      dispatch(addMessage({
        role: "assistant",
        content: data.answer,
        images: data.images
      }));

      try {
        const { data: userData } = await api.get("/api/me");
        dispatch(setUserData(userData));
      } catch (error) {
        console.error("Unable to refresh credit balance:", error);
        setError("Message sent, but the credit balance could not be refreshed. Reload to see the latest balance.");
      }
    } catch (error) {
      console.error("Unable to send message:", error);
      setError(error?.response?.data?.message || error?.message || "Unable to get a response. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const agents = [
    {
      id: "auto",
      icon: Zap,
      label: "Auto"
    },

    {
      id: "chat",
      icon: MessageSquare,
      label: "Chat"
    },

    {
      id: "coding",
      icon: Code2,
      label: "Coding"
    },

    {
      id: "pdf",
      icon: FileText,
      label: "PDF"
    },

    {
      id: "ppt",
      icon: Presentation,
      label: "PPT"
    },

    {
      id: "debug",
      icon: Bug,
      label: "Debug"
    },

    {
      id: "vision",
      icon: ImageIcon,
      label: "Vision"
    },

    {
      id: "search",
      icon: Globe,
      label: "Search"
    }

  ]

  return (
    <div className="w-full overflow-hidden px-3 md:px-5 py-4 border-t border-white/[0.06] bg-[#0d0f14]">
      <div className="flex flex-col gap-2 bg-white/[0.03] border border-white/[0.07] rounded-2xl px-4 pt-3.5 pb-3">
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <div className='flex w[80%] gap-2 pr-3 flex-wrap'>
          {agents.map((agent) => {
            const isActive = selectedAgent === agent.label
            const Icon = agent.icon
            return (
              <div onClick={() => setSelectedAgent(agent.label)}
                className={`flex-shrink-0 cursor-pointer inline-flex items-center gap-2 px-3 py-2
                rounded-full text-xs font-medium border transition-all ${isActive
                    ? "bg-linear-to-r from-indigo-500 to-violet-600 text-white border-transparent shadow-[0_1px_8px_rgba(99,102,241,.35)]"
                    : "bg-white/[0.03] text-slate-400 border-white/[0.06] hover:bg-white/[0.07]"
                  }`}>
                <Icon size={14} className={
                  isActive
                    ? "text-white"
                    : "text-slate-500"
                } />

                {agent.label}

              </div>
            )
          })}
        </div>

        {selectedFile &&
          <div className='my-3'>
            <div className='inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2'>
              {
                selectedFile?.type === "application/pdf" ? <FileText size={16}
                  className='text-red-600'
                />
                  : selectedFile.type.startsWith("image/") && <img src={URL.createObjectURL(selectedFile)}
                    className='h-10 w-10 rounded-xl object-cover mt-3' />
              }

              <div>
                <p className='text-xs text-white'>
                  {selectedFile?.name}
                </p>
                <p className='text-[10px] text-slate-500'>
                  {Math.ceil(selectedFile.size)}KB
                </p>
              </div>

              <button className='ml-2' onClick={() => { setSelectedFile(null); fileRef.current.value = "" }}>
                <X size={14} className='text-slate-500 hover:text-white' />
              </button>
            </div>
          </div>
        }
        <textarea
          placeholder="Ask Anything..."
          onChange={(e) => setValue(e.target.value)}
          value={value}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isSending) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          className="w-full bg-transparent outline-none resize-none text-[14px] text-slate-200 placeholder:text-slate-600 leading-relaxed [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          rows={3}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">

            <input type="file" accept='.pdf,image/*' hidden ref={fileRef} onChange={(e) => {
              const file = e.target.files[0]
              if (file) {
                setSelectedFile(file)
              }
            }} />
            <button onClick={() => fileRef.current.click()}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] border border-transparent hover:border-white/[0.06] transition-all duration-150 bg-transparent cursor-pointer"
            >
              <Paperclip size={16} />
            </button>

            <button onClick={toggleMic}
              className={`flex items-center justify-center w-8 h-8 rounded-lg 
                 transition-all duration-150  cursor-pointer
                  ${listen ? "bg-red-500 text-white"
                    : "text-slate-600 hover:bg-white/[0.05]" 
                  }`}
            >
             {listen ?  <Mic size={16} /> : <MicOff size={16} /> }
            </button>
          </div>

          <button
            type="button"
            disabled={!value.trim() || isSending}
            onClick={handleSendMessage}
            className={`flex items-center justify-center w-8 h-8 rounded-lg border-none transition-all duration-150 ${value.trim() && !isSending
                ? 'bg-gradient-to-br from-indigo-500 to-violet-700 hover:opacity-90 text-white cursor-pointer'
                : 'bg-white/[0.05] text-slate-600 cursor-not-allowed'
              }`}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatInput;
