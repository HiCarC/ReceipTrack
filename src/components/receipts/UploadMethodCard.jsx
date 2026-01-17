import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Camera, List, Users } from 'lucide-react';
import { db } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export default function UploadMethodCard({
  showOnly,
  fileInputRef,
  handleImageChange,
  handleOpenCamera,
  handleManualEntry,
  recentGroups,
  groups,
  setSelectedGroupId,
  groupSwitcherOpen,
  setGroupSwitcherOpen,
  setGroups,
  user,
}) {
  const isVisible = showOnly === 'upload' || !showOnly;

  if (!isVisible) {
    return null;
  }

  return (
    <div className="w-full md:w-1/3 flex-col items-center mb-8 md:mb-0 flex md:flex">
      <Card className="w-full p-4 md:p-6 flex flex-col items-center justify-start gap-4 bg-slate-800/80 text-white shadow-2xl rounded-xl border border-blue-400/20">
        <CardHeader className="w-full text-center p-0 mb-4">
          <CardTitle className="text-xl md:text-2xl font-bold text-blue-100">Add Receipt</CardTitle>
        </CardHeader>
        <CardContent className="w-full flex flex-col items-center justify-center gap-4 p-0">
          <input
            type="file"
            id="fileInput"
            ref={fileInputRef}
            onChange={handleImageChange}
            accept="image/*"
            className="hidden"
          />
          <Button
            onClick={() => document.getElementById('fileInput').click()}
            className="w-full bg-blue-700 text-white font-semibold py-3 rounded-xl hover:bg-blue-800 transition-all duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg overflow-hidden"
          >
            <Upload className="h-5 w-5" />
            Upload &amp; Process
          </Button>
          <Button
            onClick={handleOpenCamera}
            className="w-full bg-blue-700 text-white font-semibold py-3 rounded-xl hover:bg-blue-800 transition-all duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg overflow-hidden"
          >
            <Camera className="h-5 w-5" />
            Take Photo
          </Button>
          <Button
            onClick={handleManualEntry}
            className="w-full bg-blue-700 text-white font-semibold py-3 rounded-xl hover:bg-blue-800 transition-all duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg overflow-hidden"
          >
            <List className="h-5 w-5" />
            Enter Manually
          </Button>

          {recentGroups && recentGroups.length > 0 && (
            <div className="w-full mt-2">
              <div className="text-xs uppercase tracking-wider text-blue-300/80 mb-2 flex items-center gap-2">
                <Users className="h-3.5 w-3.5"/> Quick to Group
              </div>
              <div className="flex w-full gap-2 overflow-x-auto no-scrollbar py-1">
                {groups
                  .filter(g => !g.archived && !g.deleted)
                  .sort((a, b) => (b.uses || 0) - (a.uses || 0))
                  .slice(0, 6)
                  .map(g => (
                    <button
                      key={g.id}
                      onClick={() => {
                        setSelectedGroupId(g.id);
                        setTimeout(() => {
                          try { document.getElementById('fileInput')?.click(); } catch {}
                        }, 50);
                      }}
                      onContextMenu={(e) => { e.preventDefault(); setGroupSwitcherOpen(true); }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-700/40 bg-slate-900/40 text-blue-100 hover:border-blue-400 hover:bg-blue-900/30 transition-all whitespace-nowrap"
                    >
                      <span className="text-base">{g.emoji || 'G'}</span>
                      <span className="text-sm font-medium max-w-[140px] truncate">{g.name}</span>
                    </button>
                  ))}
              </div>
              {groupSwitcherOpen && (
                <div className="mt-2 p-3 rounded-xl bg-slate-900/80 border border-blue-700/40">
                  <div className="text-xs text-blue-300/80 mb-2">Manage Groups</div>
                  <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto">
                    {groups.map(g => (
                      <div key={g.id} className="flex items-center gap-2">
                        <button
                          className="px-2 py-1 rounded-lg bg-slate-800/60 border border-blue-700/40 text-blue-100 hover:border-blue-400"
                          onClick={() => { setSelectedGroupId(g.id); setGroupSwitcherOpen(false); }}
                        >
                          {g.emoji || 'G'} {g.name}
                        </button>
                        <button
                          className="text-xs underline text-blue-300/90 hover:text-blue-200"
                          onClick={async () => {
                            const name = prompt('Rename group', g.name);
                            if (name && user) {
                              try {
                                await updateDoc(doc(db, 'groups', g.id), { name });
                                setGroups(prev => prev.map(x => x.id === g.id ? { ...x, name } : x));
                              } catch (e) { console.warn('Rename failed', e); }
                            }
                          }}
                        >
                          Rename
                        </button>
                        <button
                          className="text-xs underline text-blue-300/90 hover:text-blue-200"
                          onClick={async () => {
                            const emoji = prompt('Set emoji (e.g., G)', g.emoji || 'G');
                            if (emoji && user) {
                              try {
                                await updateDoc(doc(db, 'groups', g.id), { emoji });
                                setGroups(prev => prev.map(x => x.id === g.id ? { ...x, emoji } : x));
                              } catch (e) { console.warn('Icon update failed', e); }
                            }
                          }}
                        >
                          Icon
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-right">
                    <button
                      className="text-xs underline text-blue-300/90 hover:text-blue-200"
                      onClick={() => setGroupSwitcherOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
