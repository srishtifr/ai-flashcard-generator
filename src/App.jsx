import { useState, useEffect } from 'react';

function App() {
  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Application Main States
  const [flashcards, setFlashcards] = useState(() => {
    const saved = localStorage.getItem("my_flashcards");
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTab] = useState("ai"); 
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Inputs
  const [aiNotes, setAiNotes] = useState("");
  const [pdfData, setPdfData] = useState(null); 
  const [pdfFileName, setPdfFileName] = useState(""); 
  const [cardCount, setCardCount] = useState("10"); 
  const [manualFront, setManualFront] = useState("");
  const [manualBack, setManualBack] = useState("");

  useEffect(() => {
    localStorage.setItem("my_flashcards", JSON.stringify(flashcards));
  }, [flashcards]);

  useEffect(() => {
    if (flashcards.length > 0 && currentIndex >= flashcards.length) {
      setCurrentIndex(0);
    }
  }, [flashcards.length, currentIndex]);

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (email.trim() && password.trim()) {
      setIsLoggedIn(true);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPdfFileName(file.name);

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result.split(',')[1];
      setPdfData({
        inlineData: { data: base64String, mimeType: file.type }
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAddManualCard = (e) => {
    e.preventDefault();
    if (!manualFront.trim() || !manualBack.trim()) return;

    setFlashcards([...flashcards, {
      id: Date.now(),
      front: manualFront,
      back: manualBack
    }]);
    setManualFront("");
    setManualBack("");
  };

  const handleGenerateAICards = async (e) => {
    e.preventDefault();
    if (!aiNotes.trim() && !pdfData) return;

    const parsedCount = parseInt(cardCount, 10) || 10;
    setLoading(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const systemInstructions = `Take the attached study document and/or notes and extract exactly ${parsedCount} high-yield flashcards. 
      You must respond ONLY with a raw JSON array containing exactly ${parsedCount} items matching this exact format with no extra text or markdown wrappers:
      [{"front": "Question/Concept", "back": "Answer/Definition"}].
      Additional context notes provided by user: ${aiNotes}`;

      const partsPayload = [{ text: systemInstructions }];
      if (pdfData) {
        partsPayload.push({
          inlineData: { data: pdfData.inlineData.data, mimeType: pdfData.inlineData.mimeType }
        });
      }

      const apiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: partsPayload }] })
        }
      );

      if (!apiResponse.ok) {
        const errData = await apiResponse.json();
        throw new Error(errData?.error?.message || "HTTP Connection Error");
      }

      const resultData = await apiResponse.json();
      let cleanText = resultData.candidates[0].content.parts[0].text.trim();

      if (cleanText.startsWith("```json")) {
        cleanText = cleanText.replace(/```json|```/g, "").trim();
      } else if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/```/g, "").trim();
      }

      const aiCards = JSON.parse(cleanText);
      const cardsWithIds = aiCards.map((card, index) => ({
        ...card,
        id: Date.now() + index
      }));

      setFlashcards([...flashcards, ...cardsWithIds]);
      setAiNotes("");
      setPdfData(null); 
      setPdfFileName(""); 
      e.target.reset(); 
      setCurrentIndex(flashcards.length);
    } catch (error) {
      console.error("Gemini Build Error Detail:", error);
      alert(`Error generating cards: ${error.message || "Verify connection permissions"}`);
    }
    setLoading(false);
  };

  const handleDeleteCard = (idToDelete, e) => {
    e.stopPropagation();
    setFlashcards(flashcards.filter(card => card.id !== idToDelete));
    setIsFlipped(false);
    setCurrentIndex(0);
  };

  const handleNext = () => {
    if (flashcards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => { setCurrentIndex((prev) => (prev + 1) % flashcards.length); }, 150);
  };

  const handlePrevious = () => {
    if (flashcards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => { setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length); }, 150);
  };

  const progressPercent = flashcards.length > 0 ? ((currentIndex + 1) / flashcards.length) * 100 : 0;

  // --- CONDITIONAL VIEW 1: LOGIN COMPONENT ---
  if (!isLoggedIn) {
    return (
      <div style={{ backgroundColor: '#f4f7f5', minHeight: '100vh' }} className="d-flex align-items-center justify-content-center p-3">
        <div className="card p-4 shadow-sm w-100" style={{ maxWidth: '400px', borderRadius: '12px', border: '1px solid #e2e8e4' }}>
          <h2 className="h4 text-center fw-bold mb-1" style={{ color: '#3b5246' }}>Welcome Back</h2>
          <p className="text-muted text-center small mb-4">Sign in to manage your workspace</p>
          
          <form onSubmit={handleLoginSubmit}>
            <div className="mb-3">
              <label className="form-label small fw-semibold text-muted">Email Address</label>
              <input 
                type="email" 
                className="form-control" 
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
            <div className="mb-4">
              <label className="form-label small fw-semibold text-muted">Password</label>
              <input 
                type="password" 
                className="form-control" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>
            <button type="submit" className="btn w-100 text-uppercase text-white fw-bold py-2" style={{ backgroundColor: '#556f60' }}>
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- CONDITIONAL VIEW 2: FLASHCARD DASHBOARD ---
  return (
    <div className="container-fluid my-4 px-4">
      <header className="mb-4 d-flex justify-content-between align-items-center pb-2 border-bottom">
        <div>
          <h1 className="h4 fw-bold mb-0" style={{ color: '#3b5246' }}>
            Your Flashcard Maker
          </h1>
        </div>
        <div className="d-flex align-items-center gap-3">
          {flashcards.length > 0 && (
            <div className="small-indicator">
              {currentIndex + 1} / {flashcards.length}
            </div>
          )}
          <button className="btn btn-sm btn-outline-secondary py-1 px-2.5 small" onClick={() => setIsLoggedIn(false)}>
            Logout
          </button>
        </div>
      </header>

      <div className="master-flex-wrapper">
        <div className="left-control-panel">
          <div className="card studio-card overflow-hidden">
            <div className="card-header studio-header p-2">
              <ul className="nav nav-tabs border-0">
                <li className="nav-item">
                  <button className={`nav-link py-2 px-3 ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>
                    ✨ AI Create
                  </button>
                </li>
                <li className="nav-item">
                  <button className={`nav-link py-2 px-3 ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => setActiveTab('manual')}>
                    ✍️ Manual
                  </button>
                </li>
              </ul>
            </div>
            
            <div className="card-body p-3">
              {activeTab === 'ai' ? (
                <form onSubmit={handleGenerateAICards}>
                  <div className="mb-3">
                    <label className="form-label fw-semibold small mb-1" style={{ color: '#4a5d4e' }}>
                      Upload Study Document (PDF)
                    </label>
                    <div className="position-relative custom-file-container">
                      <label 
                        htmlFor="pdf-upload" 
                        className="d-flex flex-column align-items-center justify-content-center border rounded p-3 w-100 text-center"
                        style={{ 
                          backgroundColor: pdfFileName ? '#f4f7f5' : '#fafafa', 
                          borderStyle: 'dashed',
                          borderColor: pdfFileName ? '#8da393' : '#ced4da',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease-in-out'
                        }}
                      >
                        <span className="fs-4 mb-1">{pdfFileName ? '📄' : '📤'}</span>
                        <span className="small fw-medium text-truncate w-100 px-2" style={{ color: '#333' }}>
                          {pdfFileName ? pdfFileName : 'Click to browse or drop PDF here'}
                        </span>
                        {!pdfFileName && <span className="text-muted" style={{ fontSize: '0.7rem' }}>Supports documents up to 10MB</span>}
                      </label>
                      <input id="pdf-upload" type="file" className="d-none" accept=".pdf" onChange={handleFileChange} disabled={loading} />
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-semibold small mb-1">Context Notes (Optional if PDF added)</label>
                    <textarea 
                      className="form-control custom-input small" rows="3"
                      placeholder="Paste your source text or instructions here..."
                      value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} disabled={loading}
                    ></textarea>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold small mb-1">Number of Flashcards to Create</label>
                    <input 
                      type="number" min="1" max="50" className="form-control custom-input py-1.5 small"
                      placeholder="Type target amount (e.g., 15)" value={cardCount}
                      onChange={(e) => setCardCount(e.target.value)} disabled={loading}
                    />
                  </div>

                  <button type="submit" className="btn btn-sage-primary w-100 py-2 small text-uppercase tracking-wider" disabled={loading || (!aiNotes.trim() && !pdfData)}>
                    {loading ? "Analyzing Document..." : "+ Generate Flashcards"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAddManualCard}>
                  <div className="mb-2">
                    <label className="form-label fw-semibold small mb-1">Question</label>
                    <input type="text" className="form-control custom-input py-1.5 small" placeholder="What do you want to learn?" value={manualFront} onChange={(e) => setManualFront(e.target.value)} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold small mb-1">Answer</label>
                    <textarea className="form-control custom-input small" rows="2" placeholder="What's the answer?" value={manualBack} onChange={(e) => setManualBack(e.target.value)}></textarea>
                  </div>
                  <button type="submit" className="btn btn-sage-primary w-100 py-2 small text-uppercase tracking-wider" disabled={!manualFront.trim() || !manualBack.trim()}>
                    + Add Card
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="flex-grow-1 overflow-auto pe-1" style={{ maxHeight: '380px' }}>
            <div className="d-flex justify-content-between align-items-center mb-2 px-1">
              <span className="small text-uppercase fw-bold text-muted" style={{ fontSize: '0.7rem' }}>Your card Stack</span>
              {flashcards.length > 0 && (
                <button className="btn btn-link text-danger text-decoration-none p-0 small" style={{ fontSize: '0.75rem' }} onClick={() => { setFlashcards([]); setCurrentIndex(0); }}>Wipe Deck</button>
              )}
            </div>

            {flashcards.map((card, idx) => (
              <div 
                key={card.id} className={`card-stack-item ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => { setCurrentIndex(idx); setIsFlipped(false); }} style={{ cursor: 'pointer', position: 'relative' }}
              >
                <div className="fw-semibold text-truncate pe-3 small" style={{ color: '#2d3a34' }}>{card.front}</div>
                <div className="text-muted text-truncate small" style={{ fontSize: '0.75rem' }}>{card.back}</div>
                <button 
                  className="position-absolute border-0 bg-transparent text-muted hover-danger"
                  style={{ top: '10px', right: '10px', fontSize: '0.85rem' }} onClick={(e) => handleDeleteCard(card.id, e)}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="right-study-viewport">
          <div className="w-100 text-center mb-2">
            <span className="text-uppercase small tracking-wider text-muted font-monospace" style={{ fontSize: '0.75rem' }}>Click the card to flip</span>
          </div>

          {flashcards.length === 0 ? (
            <div className="my-auto text-center py-5">
              <div className="fs-1 mb-2">📑</div>
              <h5 className="fw-bold">No active cards found</h5>
              <p className="text-muted small mx-auto" style={{ maxWidth: '280px' }}>Use the creation panel on the left to create flashcards.</p>
            </div>
          ) : (
            <>
              <div className={`presentation-flashcard-wrapper ${isFlipped ? 'flipped' : ''}`} onClick={() => setIsFlipped(!isFlipped)}>
                <div className="flashcard-inner">
                  <div className="card-front">
                    <span className="text-uppercase small font-monospace tracking-wider text-muted mb-3" style={{ fontSize: '0.7rem' }}>Question</span>
                    <h2 className="h4 text-center px-3 fw-bold m-0" style={{ lineHeight: '1.4', color: '#2d3a34' }}>{flashcards[currentIndex].front}</h2>
                    <span className="text-muted small mt-4" style={{ fontSize: '0.75rem', opacity: 0.6 }}>Click to reveal solution</span>
                  </div>
                  <div className="card-back">
                    <span className="text-uppercase small font-monospace tracking-wider text-muted mb-3" style={{ fontSize: '0.7rem' }}>Answer Definition</span>
                    <p className="fs-5 text-center px-3 m-0" style={{ lineHeight: '1.5' }}>{flashcards[currentIndex].back}</p>
                    <span className="text-muted small mt-4" style={{ fontSize: '0.75rem', opacity: 0.6 }}>Click to see question</span>
                  </div>
                </div>
              </div>

              <div className="w-100 d-flex flex-column align-items-center">
                <div className="progress-container-bar"><div className="progress-filler" style={{ width: `${progressPercent}%` }}></div></div>
                <div className="d-flex align-items-center gap-2">
                  <button className="btn btn-nav-outline" onClick={handlePrevious}>← Previous</button>
                  <button className="btn btn-sage-primary" onClick={handleNext}>Next →</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;