import React from 'react'
import api from './../utils/axios';

async function getMessages(id) {
  try {
    const {data} = await api.get(`/api/chat/get-message/${id}`)
    return data
  } catch (error) {
    console.log(`error to get message from frontend ${error}`)
    return []
  }
}

export default getMessages
