import { useEffect, useRef } from 'react'
import Navbar from './Navbar'
import MessageList from './MessageList'
import ChatInput from './ChatInput'
import { useDispatch, useSelector } from 'react-redux'
import  getMessages  from '../features/getMessages'
import { setArtifacts, setmessages } from "../redux/messageSlice"

function ChatArea() {
      const {selectedConversation} = useSelector(state => state.conversation)
      const dispatch = useDispatch()
      const conversationId = selectedConversation?._id
      const selectedConversationRef = useRef(selectedConversation)

  useEffect(() => {
    selectedConversationRef.current = selectedConversation
  }, [selectedConversation])

  useEffect(() => {
    let isCurrentConversation = true
    dispatch(setArtifacts([]))
    dispatch(setmessages([]))

    if(conversationId){
      if (selectedConversationRef.current?.title === "New Chat") {
        return () => {
          isCurrentConversation = false
        }
      }

      const getMsg = async () => {
        const data = await getMessages(conversationId)
        if (!isCurrentConversation) return

        dispatch(setmessages(data))
        const latestArtifact = [...data].reverse().find(msg => msg.artifacts?.length > 0)
        dispatch(setArtifacts(latestArtifact?.artifacts ?? []))
      }
      getMsg()
    }

    return () => {
      isCurrentConversation = false
    }
  },[conversationId, dispatch])

  return (
    <div className='flex-1 flex flex-col min-w-0'>
      
      {/* Navbar */}
      <Navbar/>
      {/* messagelist */}
      <MessageList/>
      {/* chatinput */}
      <ChatInput/>
    </div>
  )
}

export default ChatArea
