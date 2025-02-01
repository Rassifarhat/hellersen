import { exec } from 'child_process';
import fs from 'fs';
import { NextResponse } from "next/server";
import util from 'util';
import axios from 'axios';
import FormData from 'form-data';
import path from 'path';

interface IRequest {
    audio: string;
}

interface WhisperApiResponse {
  text: string;
}

const execAsync = util.promisify(exec);

// Function to save audio file with timestamp
function saveAudioFile(audioBuffer: Buffer): string {
  const uploadDir = path.join(process.cwd(), 'uploads/audio');
  
  // Create uploads directory if it doesn't exist
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `audio-${timestamp}.webm`;
  const filePath = path.join(uploadDir, filename);

  // Save the file
  fs.writeFileSync(filePath, audioBuffer);
  console.log(`Audio file saved: ${filePath}`);
  
  return filePath;
}

export async function POST(request:Request):Promise<NextResponse> {
  try {
    const req:IRequest = await request.json();
    console.log("Received request: ", req.audio);
    
    // Convert the Base64 audio data back to a Buffer
    const audioBuffer = Buffer.from(req.audio, 'base64');

    // Save the audio file before processing
    const savedFilePath = saveAudioFile(audioBuffer);
    console.log(`Original audio saved to: ${savedFilePath}`);

    try {
      const text:string = await convertAudioToText(audioBuffer);
      console.log("Transcription from server complete: ", text);
      return NextResponse.json({
        result: text,
        savedAudioPath: savedFilePath
      }, {status:200});
    } catch(error:any) {
      if (error.response) {
        return NextResponse.json({ error: error.response.data }, {status:500});
      } else {
        return NextResponse.json({ error: "An error occurred during your request." }, {status:500});
      }
    }
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, {status:400});
  }
}





async function convertAudioToText(audioData:Buffer): Promise<string> {
    const inputPath = '/tmp/input.webm';
    const outputPath = '/tmp/output.mp3';
    fs.writeFileSync(inputPath, new Uint8Array(audioData));
     
    // Use better ffmpeg settings for speech
    await execAsync(`ffmpeg -y -i ${inputPath} ${outputPath}`);
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(outputPath));
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'json');
   

    const config = {
        headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": `multipart/form-data; boundary=${(formData as any)._boundary}`,
        },
    };

    try {
        const response = await axios.post<WhisperApiResponse>(
          'https://api.openai.com/v1/audio/transcriptions',
          formData,
          config
        );
        const transcribedText:string = response.data.text;
        // Clean up temp files
        fs.unlinkSync(outputPath);
        console.log("Transcription complete: ", transcribedText);
        return transcribedText as string;
        
    } catch (error:any) {
        // Clean up temp files even on error
       
        console.error("Error during OpenAI transcription:", error);
        if (error.response?.data?.error) {
            console.error("Error details:", error.response.data.error);
        }
        throw error;
    }
}
  
