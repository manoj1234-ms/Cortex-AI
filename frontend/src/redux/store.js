import { configureStore } from '@reduxjs/toolkit'
import userReducer from "./userSlice"
import conversaionReducer from "./conversationSlice"
import messageReducer from "./messageSlice"
export const store = configureStore({
  reducer: {
    user:userReducer,
    conversation:conversaionReducer,
    message:messageReducer

  },
})