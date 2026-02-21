import { useEffect, useRef, useState } from 'react';
import {
  FileText,
  Send,
  Sparkles,
  ShieldCheck,
  Zap,
  RefreshCw,
  Github,
  Bot,
  User,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system_memory';
  content: string;
};

const apiKey: string = import.meta.env?.VITE_GEMINI_API_KEY ?? '';

const parseMarkdown = (text: string): string => {
  if (!text) return '';
  const html = text
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-4 mb-2 text-emerald-400">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-5 mb-3 text-emerald-300">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4 text-emerald-500">$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n$/gim, '<br />');
  return html;
};

type GeminiPayload = {
  contents: { parts: { text: string }[] }[];
  systemInstruction?: { parts: { text: string }[] };
};

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

const callGemini = async (prompt: string, systemInstruction: string | null = null): Promise<string> => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload: GeminiPayload = {
    contents: [{ parts: [{ text: prompt }] }],
  };
  if (systemInstruction) {
    payload.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  const retries = 5;
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = (await response.json()) as GeminiResponse;
      return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Error: Sin respuesta del modelo.';
    } catch {
      if (i === retries - 1) throw new Error('Fallo en la API tras múltiples intentos.');
      await new Promise((resolve) => setTimeout(resolve, delays[i]));
    }
  }
  return 'Error';
};

export default function App() {
  const [step, setStep] = useState<number>(1);
  const [inputType, setInputType] = useState<'url' | 'text'>('url');
  const [inputValue, setInputValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [contractText, setContractText] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const handleGenerateContract = async () => {
    if (!inputValue.trim()) {
      setError('Por favor, introduce una URL o texto de contexto.');
      return;
    }
    if (!apiKey) {
      setError('Falta VITE_GEMINI_API_KEY en tu entorno. Configura tu clave de Gemini antes de continuar.');
      return;
    }
    setLoading(true);
    setError(null);
    let contextData = '';
    try {
      if (inputType === 'url') {
        setLoadingText('Extrayendo repositorio con Jina Reader...');
        const response = await fetch(`https://r.jina.ai/${inputValue}`);
        if (!response.ok) throw new Error('No se pudo leer la URL de GitHub.');
        contextData = await response.text();
      } else {
        contextData = inputValue;
      }
      setLoadingText('Arquitecto IA redactando el Contract.md...');
      const systemPrompt = `
        Actúa como Arquitecto de Software Senior y Especialista en Gobernanza de IA.
        Tu misión es generar un 'contract.md' para un desarrollo guiado por IA (SDD). 
        Analiza el contexto adjunto y define estrictamente usando Markdown:
        1. 🤝 Filosofía y Roles (relación de igualdad, visión Kaizen).
        2. 🏗️ Arquitectura y Límites (Patrones permitidos, Task Boundaries, tamaño máx de funciones).
        3. 🛡️ Auditoría y Seguridad (Reglas obligatorias para analizadores estáticos, manejo de secretos).
        4. 🔄 Gestión de Contexto (Cuándo compactar la sesión).
        5. 🧪 Calidad y Deuda Técnica (Definición de "Hecho").
        Devuelve SOLO el contenido del archivo Markdown.
      `;
      const generatedContract = await callGemini(
        `Aquí tienes el contexto del proyecto:\n\n${contextData.substring(0, 30000)}`,
        systemPrompt,
      );
      setContractText(generatedContract.replace(/```markdown|```/g, '').trim());
      setStep(2);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error desconocido al generar el contrato.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: currentMessage };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setCurrentMessage('');
    setLoading(true);
    try {
      const systemInstruction = `
        Eres mi "Senior Partner" en el desarrollo de este proyecto. Somos iguales.
        DEBES OBEDECER ESTRICTAMENTE ESTE CONTRATO (Tu Constitución):
        
        --- INICIO DEL CONTRATO ---
        ${contractText}
        --- FIN DEL CONTRATO ---
        
        Evalúa mi petición basándote en las reglas del contrato. Si mi petición viola la seguridad, 
        la arquitectura o crea deuda técnica, detenme, explícame por qué según el contrato, 
        y propón la alternativa correcta.
      `;
      const chatContext = newHistory
        .map((m) => `${m.role === 'user' ? 'Tú' : 'IA'}: ${m.content}`)
        .join('\n');
      const response = await callGemini(`Conversación actual:\n${chatContext}\n\nTú (IA):`, systemInstruction);
      setChatHistory([...newHistory, { role: 'assistant', content: response }]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error desconocido';
      setChatHistory([...newHistory, { role: 'assistant', content: `⚠️ Error de conexión: ${message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCompactContext = async () => {
    if (chatHistory.length === 0) return;
    setLoading(true);
    try {
      const chatContext = chatHistory.map((m) => `${m.role === 'user' ? 'Usuario' : 'IA'}: ${m.content}`).join('\n');
      const summaryPrompt = `
        Actúa como un resumidor de sesiones de desarrollo. Lee este historial de chat y extrae un resumen ultra-compacto.
        Debes incluir:
        - 📦 Decisiones Arquitectónicas Tomadas.
        - ✅ Funciones/Módulos Completados.
        - 📝 Tareas Pendientes o Bugs descubiertos.
        
        Historial a compactar:
        ${chatContext}
      `;
      const summary = await callGemini(summaryPrompt);
      setChatHistory([
        {
          role: 'system_memory',
          content: `**🔄 Contexto Compactado Exitosamente:**\n\n${summary}`,
        },
      ]);
    } catch {
      alert('Error al compactar el contexto.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30">
      <header className="border-b border-slate-800 bg-slate-900/50 p-4 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Debt Tech Remover</h1>
              <p className="text-xs text-slate-400">SDD Framework & AI Contract Architect</p>
            </div>
          </div>
          <div className="flex gap-4 text-sm font-medium text-slate-400">
            <span className={step >= 1 ? 'text-emerald-400' : ''}>1. Ingesta</span>
            <span>→</span>
            <span className={step >= 2 ? 'text-emerald-400' : ''}>2. Contrato</span>
            <span>→</span>
            <span className={step >= 3 ? 'text-emerald-400' : ''}>3. Workspace</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {step === 1 && (
          <div className="max-w-2xl mx-auto mt-12 space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-white">Previene la deuda técnica por diseño</h2>
              <p className="text-slate-400 leading-relaxed">
                Antes de escribir una sola línea de código, analicemos tu idea o repositorio y establezcamos las reglas de
                juego (Contract.md). Tu IA actuará como un Senior Partner, no como un autocompletador ciego.
              </p>
            </div>

            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => setInputType('url')}
                  className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                    inputType === 'url'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <Github className="w-5 h-5" /> GitHub URL
                </button>
                <button
                  onClick={() => setInputType('text')}
                  className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                    inputType === 'text'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <FileText className="w-5 h-5" /> Pegar README
                </button>
              </div>

              {inputType === 'url' ? (
                <input
                  type="text"
                  placeholder="https://github.com/usuario/repo"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
              ) : (
                <textarea
                  rows={6}
                  placeholder="Pega aquí tu README o describe tu idea detalladamente..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all resize-none"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleGenerateContract}
                disabled={loading}
                className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/20"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" /> {loadingText}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" /> Generar Contract.md
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <FileText className="text-emerald-400" /> Contract.md Generado
                </h2>
                <p className="text-slate-400 text-sm mt-1">Revisa, edita si es necesario y firma para establecer las reglas.</p>
              </div>
              <button
                onClick={() => setStep(3)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg shadow-emerald-900/20"
              >
                <CheckCircle className="w-5 h-5" /> Firmar y Empezar
              </button>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
              <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="bg-slate-950 px-4 py-2 text-xs font-mono text-slate-500 border-b border-slate-800">contract.md (Editable)</div>
                <textarea
                  className="flex-1 w-full bg-transparent p-6 text-slate-300 font-mono text-sm leading-relaxed focus:outline-none resize-none"
                  value={contractText}
                  onChange={(e) => setContractText(e.target.value)}
                />
              </div>

              <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="bg-slate-950 px-4 py-2 text-xs font-mono text-emerald-500 border-b border-slate-800">Vista Previa (Preview)</div>
                <div
                  className="flex-1 overflow-y-auto p-8 prose prose-invert prose-emerald max-w-none text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(contractText) }}
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="h-[85vh] grid grid-cols-12 gap-6 animate-in slide-in-from-right-8 duration-500">
            <div className="col-span-4 flex flex-col bg-slate-900 border border-emerald-900/30 rounded-2xl overflow-hidden shadow-xl relative">
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
              <div className="bg-slate-950/80 px-4 py-3 border-b border-emerald-900/30 flex justify-between items-center z-10">
                <span className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Contrato Activo (Constitución)
                </span>
              </div>
              <div
                className="flex-1 overflow-y-auto p-6 prose prose-invert prose-emerald max-w-none text-xs leading-relaxed opacity-90 relative z-10"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(contractText) }}
              />
            </div>

            <div className="col-span-8 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Tu Senior Partner IA</h3>
                    <p className="text-xs text-emerald-500">Gobernanza estricta activada</p>
                  </div>
                </div>
                <button
                  onClick={handleCompactContext}
                  disabled={loading || chatHistory.length === 0}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                  title="Resumir y limpiar el contexto para evitar alucinaciones"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Compactar Contexto
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {chatHistory.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                    <Zap className="w-12 h-12 text-slate-700" />
                    <p>El contrato está firmado. ¿Por dónde empezamos, Partner?</p>
                  </div>
                )}

                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                        msg.role === 'user'
                          ? 'bg-blue-500/20 text-blue-400'
                          : msg.role === 'system_memory'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        <User className="w-4 h-4" />
                      ) : msg.role === 'system_memory' ? (
                        <RefreshCw className="w-4 h-4" />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )}
                    </div>

                    <div
                      className={`max-w-[80%] rounded-2xl p-4 ${
                        msg.role === 'user'
                          ? 'bg-blue-600/20 border border-blue-500/20 text-blue-50'
                          : msg.role === 'system_memory'
                          ? 'bg-amber-900/20 border border-amber-500/30 text-amber-200/90 text-sm'
                          : 'bg-slate-800 border border-slate-700 text-slate-200'
                      }`}
                    >
                      <div
                        className={`prose prose-invert max-w-none text-sm ${msg.role === 'user' ? '' : 'prose-emerald'}`}
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
                      />
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-emerald-400 animate-pulse" />
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-slate-400 text-sm flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-75" />
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-150" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 bg-slate-950 border-t border-slate-800">
                <div className="relative flex items-center">
                  <textarea
                    rows={2}
                    placeholder="Describe el siguiente paso (la IA lo validará contra el contrato)..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-4 pr-14 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none transition-all"
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!currentMessage.trim() || loading}
                    className="absolute right-3 bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 text-center">
                  Shift + Enter para nueva línea. Todo código generado pasará por la "Auditoría del Contrato".
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
