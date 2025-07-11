'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import Webcam from 'react-webcam';
import { CameraIcon, PhotoIcon } from '@heroicons/react/24/outline';



export default function Home() {
  const [mode, setMode] = useState<'upload' | 'camera' | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(true);


  const webcamRef = useRef<Webcam>(null);

  const capturePhoto = async () => {
    try {
      const photo = webcamRef.current?.getScreenshot();
      if (photo) {
        setImage(photo);
        setCameraActive(false); // Freeze the camera view
        // Convert base64 to blob
        const res = await fetch(photo);
        const blob = await res.blob();
        await generateAvatar(blob);
      }
    } catch (err) {
      console.error('Error capturing photo:', err);
      setError('Error capturing photo. Please try again.');
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0];
      setImage(URL.createObjectURL(file));
      await generateAvatar(file);
    }
  });

  const generateAvatar = async (imageData: Blob) => {
    try {
      setError(null);
      setLoading(true);
      const formData = new FormData();
      formData.append('image', imageData);

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      // Check if response is empty
      const responseText = await response.text();
      if (!responseText) {
        throw new Error('Empty response from server');
      }

      // Try to parse the JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError, 'Response text:', responseText);
        throw new Error('Invalid response from server. Check if your API key is configured properly.');
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate avatar');
      }

      if (!data.url) {
        throw new Error('No avatar URL received');
      }

      setResult(data.url);
    } catch (error) {
      const err = error as Error;
      console.error('Error generating avatar:', err);
      setError(err.message || 'Failed to generate avatar. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-black relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      <div className="z-10 max-w-2xl w-full items-center justify-between font-mono text-sm">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-mono mb-4 text-white tracking-tight">Notion Avatar Creator</h1>
          <div className="flex items-center justify-center gap-1 text-gray-400">
            <span className="block w-2 h-0.5 bg-gray-400"></span>
            <p className="text-sm">minimalist portraits</p>
            <span className="block w-2 h-0.5 bg-gray-400"></span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6 w-full max-w-xl mx-auto bg-white/5 p-8 rounded border border-white/10 backdrop-blur-sm relative">
          {!mode && (
            <div className="flex gap-4 mb-8">
              <button
                onClick={() => setMode('upload')}
                className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded border border-white/20 hover:bg-white/20 transition-colors"
              >
                <PhotoIcon className="w-5 h-5" />
                Upload Photo
              </button>
              <button
                onClick={() => setMode('camera')}
                className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded border border-white/20 hover:bg-white/20 transition-colors"
              >
                <CameraIcon className="w-5 h-5" />
                Use Camera
              </button>
            </div>
          )}

          {mode === 'upload' && (
            <div
              {...getRootProps()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-gray-400 transition-colors"
            >
              <input {...getInputProps()} />
              <PhotoIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">Drag & drop an image here, or click to select one</p>
            </div>
          )}

          {mode === 'camera' && (
            <div className="text-center mt-8">
              <div className="relative mb-4">
                {cameraActive ? (
                  <Webcam
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="w-full"
                    videoConstraints={{
                      width: 500,
                      height: 375,
                      facingMode: "user"
                    }}
                  />
                ) : (
                  image && (
                    <div className="relative">
                      <img src={image} alt="Captured" className="w-full" />
                    </div>
                  )
                )}
              </div>
              <button
                onClick={cameraActive ? capturePhoto : () => {
                  setCameraActive(true);
                  setImage(null);
                  setError(null);
                }}
                className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 mx-auto"
              >
                <CameraIcon className="w-5 h-5" />
                {cameraActive ? 'Take Photo' : 'Retake Photo'}
              </button>
            </div>
          )}

          {error && (
            <div className="text-red-500 mt-4 p-4 bg-red-50 rounded-lg border border-red-100">
              {error}
            </div>
          )}

          {loading && (
            <div className="mt-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-4 text-gray-600">Generating your Notion-style avatar...</p>
            </div>
          )}

          {result && (
            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl opacity-20 group-hover:opacity-30 transition-opacity blur"></div>
                <div className="relative bg-white p-4 rounded-lg">
                  <Image src={result} alt="Generated avatar" width={256} height={256} className="max-w-xs mx-auto" />
                </div>
              </div>
              <a
                href={result}
                download="notion-avatar.png"
                className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <span>Download Avatar</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
