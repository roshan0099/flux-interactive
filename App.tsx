
import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { audioService } from './services/audioService';
import Fluid from './components/Fluid';
import { 
  Volume2, VolumeX, Volume1,
  Flame, Snowflake, Cloud, Sparkles, 
  Music, Zap, Radio, Orbit, Monitor, Speaker, Play, Pause, Upload, Disc,
  Waves, Trees
} from 'lucide-react';
import { FluidMode, InstrumentType } from './types';

const App: React.FC = () => {
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [fluidMode, setFluidMode] = useState<FluidMode>('flux');
  const [instrument, setInstrument] = useState<InstrumentType>('flux');
  const [uiTab, setUiTab] = useState<'visual' | 'audio' | 'music' | 'ambience'>('visual');
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [activeAmbience, setActiveAmbience] = useState<string | null>(null);

  const handleStart = () => {
    audioService.init();
    audioService.setMasterVolume(volume);
    audioService.resume();
    setStarted(true);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newMuteState = !muted;
    setMuted(newMuteState);
    audioService.setMute(newMuteState);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    audioService.setMasterVolume(val);
  };

  const handleInstrumentChange = (inst: InstrumentType) => {
    setInstrument(inst);
    audioService.setInstrument(inst);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      audioService.playMusic(file);
      setIsPlayingMusic(true);
      setActiveAmbience(null);
    }
  };

  const toggleMusicPlay = () => {
    audioService.toggleMusicPause();
    setIsPlayingMusic(audioService.isMusicPlaying);
  };

  const playDemoTrack = () => {
    // A royalty-free soothing ambient track
    const DEMO_TRACK = "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112778.mp3";
    audioService.playMusic(DEMO_TRACK);
    setIsPlayingMusic(true);
    // Explicitly set to null so Fluid.tsx uses the Music visualization (Wanderer) instead of Ambience (Agents)
    setActiveAmbience(null); 
  };

  const handleAmbiencePlay = (id: string, url: string) => {
    audioService.playMusic(url);
    setIsPlayingMusic(true);
    setActiveAmbience(id);
  };

  const visualModes: { id: FluidMode; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'flux', label: 'Flux', icon: <Sparkles size={16} />, color: 'from-purple-500 to-pink-500' },
    { id: 'ignite', label: 'Ignite', icon: <Flame size={16} />, color: 'from-red-500 to-orange-500' },
    { id: 'frost', label: 'Frost', icon: <Snowflake size={16} />, color: 'from-cyan-400 to-blue-600' },
    { id: 'mist', label: 'Mist', icon: <Cloud size={16} />, color: 'from-gray-100 to-gray-300' },
  ];

  const audioModes: { id: InstrumentType; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'flux', label: 'Flux', icon: <Music size={16} />, color: 'from-emerald-400 to-teal-500' },
    { id: 'drone', label: 'Drone', icon: <Radio size={16} />, color: 'from-orange-600 to-amber-700' },
    { id: 'spark', label: 'Spark', icon: <Zap size={16} />, color: 'from-yellow-300 to-yellow-500' },
    { id: 'orbit', label: 'Orbit', icon: <Orbit size={16} />, color: 'from-indigo-400 to-purple-600' },
  ];

  const ambienceModes = [
    { id: 'river', label: 'River', icon: <Waves size={16} />, url: 'https://assets.mixkit.co/active_storage/sfx/2402/2402-preview.mp3', color: 'from-cyan-600 to-blue-400' },
    { id: 'forest', label: 'Forest', icon: <Trees size={16} />, url: 'https://assets.mixkit.co/active_storage/sfx/2434/2434-preview.mp3', color: 'from-green-600 to-emerald-800' },
  ];

  return (
    <div className="relative w-full h-full bg-black text-white font-sans overflow-hidden select-none">
      
      {/* Background Canvas */}
      <div className="absolute inset-0 z-0">
        <Canvas dpr={[1, 2]} gl={{ preserveDrawingBuffer: false, alpha: false, stencil: false, depth: false, antialias: false }}>
          <Suspense fallback={null}>
            <Fluid 
              mode={fluidMode} 
              isMusicActive={isPlayingMusic} 
              ambienceMode={activeAmbience} 
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Overlay UI */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6 md:p-8 transition-opacity duration-1000"
           style={{ opacity: 1 }}>
        
        {/* Header */}
        <div className="flex justify-between items-start pointer-events-auto">
          <div className="flex flex-col">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tighter mix-blend-difference">FLUX</h1>
            <p className="text-[10px] md:text-xs opacity-70 tracking-[0.2em] uppercase mt-1 mix-blend-difference">
              Interactive Fluid Dynamics
            </p>
          </div>
          
          <button onClick={toggleMute} className="p-3 hover:bg-white/10 rounded-full transition-colors backdrop-blur-md border border-white/10 group">
             {muted ? <VolumeX size={20} className="opacity-70 group-hover:opacity-100" /> : <Volume2 size={20} className="opacity-70 group-hover:opacity-100" />}
          </button>
        </div>

        {/* Footer / Controls */}
        <div className="flex flex-col items-center justify-end gap-4 w-full pointer-events-auto">
          
          {started && (
            <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
              
              {/* Tab Switcher */}
              <div className="flex bg-black/40 backdrop-blur-md rounded-full p-1 border border-white/10 shadow-lg">
                <button 
                  onClick={() => setUiTab('visual')}
                  className={`flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all duration-300 ${uiTab === 'visual' ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'}`}
                >
                  <Monitor size={12} /> <span className="hidden md:inline">Visual</span>
                </button>
                <button 
                  onClick={() => setUiTab('audio')}
                  className={`flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all duration-300 ${uiTab === 'audio' ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'}`}
                >
                  <Speaker size={12} /> <span className="hidden md:inline">Audio</span>
                </button>
                <button 
                  onClick={() => setUiTab('music')}
                  className={`flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all duration-300 ${uiTab === 'music' ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'}`}
                >
                  <Disc size={12} /> <span className="hidden md:inline">Music</span>
                </button>
                <button 
                  onClick={() => setUiTab('ambience')}
                  className={`flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all duration-300 ${uiTab === 'ambience' ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'}`}
                >
                  <Cloud size={12} /> <span className="hidden md:inline">Ambience</span>
                </button>
              </div>

              {/* Volume Slider (Audio/Music/Ambience Tabs) */}
              {(uiTab === 'audio' || uiTab === 'music' || uiTab === 'ambience') && (
                <div className="flex items-center gap-3 px-4 py-2 bg-black/40 border border-white/10 rounded-full backdrop-blur-md shadow-lg animate-in fade-in zoom-in duration-300">
                  <Volume1 size={14} className="text-white/50" />
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01" 
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-32 md:w-48 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
                  />
                  <Volume2 size={14} className="text-white/50" />
                </div>
              )}

              {/* Controls Dock */}
              <div className="flex items-center gap-2 p-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl overflow-hidden transition-all duration-300">
                
                {/* Visual Modes */}
                {uiTab === 'visual' && visualModes.map((m) => {
                  const isActive = fluidMode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setFluidMode(m.id)}
                      className={`
                        relative group flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ease-out
                        ${isActive ? 'bg-white/15 text-white shadow-lg' : 'hover:bg-white/5 text-white/50 hover:text-white'}
                      `}
                    >
                      {isActive && (
                        <span className={`absolute inset-0 rounded-full opacity-20 bg-gradient-to-r ${m.color} blur-md`} />
                      )}
                      <span className="relative z-10">{m.icon}</span>
                      <span className={`relative z-10 text-xs font-medium tracking-wide ${isActive ? 'block' : 'hidden md:block'}`}>
                        {m.label}
                      </span>
                    </button>
                  );
                })}

                {/* Audio Instrument Modes */}
                {uiTab === 'audio' && audioModes.map((m) => {
                  const isActive = instrument === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleInstrumentChange(m.id)}
                      className={`
                        relative group flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ease-out
                        ${isActive ? 'bg-white/15 text-white shadow-lg' : 'hover:bg-white/5 text-white/50 hover:text-white'}
                      `}
                    >
                      {isActive && (
                        <span className={`absolute inset-0 rounded-full opacity-20 bg-gradient-to-r ${m.color} blur-md`} />
                      )}
                      <span className="relative z-10">{m.icon}</span>
                      <span className={`relative z-10 text-xs font-medium tracking-wide ${isActive ? 'block' : 'hidden md:block'}`}>
                        {m.label}
                      </span>
                    </button>
                  );
                })}

                {/* Ambience Modes */}
                {uiTab === 'ambience' && (
                  <>
                  {ambienceModes.map((m) => {
                    const isActive = activeAmbience === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => handleAmbiencePlay(m.id, m.url)}
                        className={`
                          relative group flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ease-out
                          ${isActive ? 'bg-white/15 text-white shadow-lg' : 'hover:bg-white/5 text-white/50 hover:text-white'}
                        `}
                      >
                        {isActive && (
                          <span className={`absolute inset-0 rounded-full opacity-20 bg-gradient-to-r ${m.color} blur-md`} />
                        )}
                        <span className="relative z-10">{m.icon}</span>
                        <span className={`relative z-10 text-xs font-medium tracking-wide ${isActive ? 'block' : 'hidden md:block'}`}>
                          {m.label}
                        </span>
                      </button>
                    );
                  })}
                  
                  {activeAmbience && (
                     <>
                      <div className="w-px h-4 bg-white/10 mx-1"></div>
                      <button
                        onClick={toggleMusicPlay}
                        className={`
                          relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300
                          ${isPlayingMusic ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}
                        `}
                      >
                        {isPlayingMusic ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                      </button>
                    </>
                  )}
                  </>
                )}

                {/* Music Controls */}
                {uiTab === 'music' && (
                  <div className="flex items-center gap-2">
                     <button
                      onClick={playDemoTrack}
                      className={`
                        relative group flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ease-out
                        ${activeAmbience === null && isPlayingMusic ? 'bg-white/15 text-white shadow-lg' : 'hover:bg-white/5 text-white/50 hover:text-white'}
                      `}
                    >
                      <Sparkles size={16} />
                      <span className="text-xs font-medium hidden md:block">Demo</span>
                    </button>

                    <label className="relative group flex items-center gap-2 px-4 py-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer">
                      <Upload size={16} />
                      <span className="text-xs font-medium hidden md:block">Upload</span>
                      <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                    </label>

                    <div className="w-px h-4 bg-white/10 mx-1"></div>

                    <button
                      onClick={toggleMusicPlay}
                      className={`
                        relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300
                        ${isPlayingMusic ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}
                      `}
                    >
                      {isPlayingMusic ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

           <div className="hidden md:block text-[10px] tracking-widest opacity-30 mix-blend-difference mt-2">
             DRAG TO EMIT &bull; CUSTOMIZE EXPERIENCE
           </div>
        </div>
      </div>

      {/* Start Overlay */}
      {!started && (
        <div 
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all duration-700 cursor-pointer"
          onClick={handleStart}
        >
          <div className="text-center animate-pulse group">
            <p className="text-xl md:text-2xl font-light tracking-[0.3em] border-b border-transparent group-hover:border-white/50 transition-all pb-4 inline-block">
              ENTER SIMULATION
            </p>
            <p className="text-xs mt-4 opacity-50 tracking-wider">Tap anywhere to begin</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
