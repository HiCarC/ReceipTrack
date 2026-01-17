import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, List, Upload } from 'lucide-react';

export default function UploadMethodModal({
  file,
  fileInputRef,
  handleImageChange,
  onUploadFile,
  onTakePhoto,
  onManualEntry,
  className = '',
}) {
  return (
    <Card className={`w-full max-w-sm p-6 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center"><Upload className="mr-2" /> Upload Receipt</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <input
          type="file"
          id="fileInput"
          ref={fileInputRef}
          onChange={handleImageChange}
          accept="image/*"
          className="hidden"
        />
        <Button onClick={() => document.getElementById('fileInput').click()} className="w-full">
          <Upload className="mr-2 h-4 w-4" /> Upload File
        </Button>
        <Button onClick={onTakePhoto} className="w-full">
          <Camera className="mr-2 h-4 w-4" /> Take Photo
        </Button>
        <Button onClick={onManualEntry} className="w-full">
          <List className="mr-2 h-4 w-4" /> Enter Manually
        </Button>
      </CardContent>
    </Card>
  );
}
