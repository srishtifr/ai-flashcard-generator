import { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";

function App() {
  const [flashcards, setFlashcards] = useState(() => {
    const saved = localStorage.getItem("my_flashcards");
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTab] = useState("ai"); 
  const [loading, setLoading] = useState(false);
  
  // Interactive presentation deck carousel controls
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Input states
  const [aiNotes, setAiNotes] = useState("");
  const [pdfData, setPdfData] = useState(null); // <-- 1. NEW STATE TO STORE PDF BASE64 DATA
  const [cardCount, setCardCount] = useState(3); 
  const [manualFront, setManualFront] = useState("");
  const [manualBack, setManualBack] = useState("");

  useEffect(() => {
    localStorage.setItem("my_flashcards", JSON.stringify(flashcards));
    if (currentIndex >= flashcards.length) {
      setCurrentIndex(0);
    }
  }, [flashcards, currentIndex]);

  // <-- 2. NEW HELPER FUNCTION TO CONVERT PDF TO BASE64
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      // FileReader gives a string starting with: "data:application/pdf;base64,..."
      // Gemini expects ONLY the raw base64 data string after the comma.
      const base64String = reader.result.split(',')[1];
      setPdfData({
        inlineData: {
          data: base64String,
          mimeType: file.type
        }
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAddManualCard = (e) => {
    e.preventDefault();
    if (!manualFront.trim() || !manualBack.trim()) return;

    const newCard = {
      id: Date.now(),
      front: manualFront,
      back: manualBack
    };

    setFlashcards([...flashcards, newCard]);
    setManualFront("");
    setManualBack("");
  };

  // 3. UPDATED AI GENERATION METHOD
  const handleGenerateAICards = async (e) => {
    e.preventDefault();
    // Guard clause: Allow submission if there is text notes OR an uploaded PDF
    if (!aiNotes.trim() && !pdfData) return;

    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: "AIzaSyDjNAr1GxY0rq2iNY3JeXrZ9kLUbjJk-bY" });
      
      const systemInstructions = `Take the attached study document and/or notes and extract exactly ${cardCount} high-yield flashcards. 
      You must respond ONLY with a raw JSON array containing exactly ${cardCount} items matching this exact format with no extra text or markdown wrappers:
      [{"front": "Question/Concept", "back": "Answer/Definition"}].
      Additional context notes provided by user: ${aiNotes}`;

      // Assemble content part array (Can accept both text instruction and file object simultaneously)
      const contentsPayload = [
        { text: systemInstructions }
      ];

      if (pdfData) {
        contentsPayload.push(pdfData);
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contentsPayload, // Pass the formatted array here
      });

      let cleanText = response.text.trim();
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
      setPdfData(null); // Clear file status 
      e.target.reset(); // Reset file input UI element 
      setCurrentIndex(flashcards.length);
    } catch (error) {
      console.error(error);
      alert("Error generating cards. Please verify your data entry parameters.");
    }
    setLoading(false);
  };

  const handleDeleteCard = (idToDelete, e) => {
    e.stopPropagation();
    const filtered = flashcards.filter(card => card.id !== idToDelete);
    setFlashcards(filtered);
    setIsFlipped(false);
    setCurrentIndex(0);
  };

  const handleNext = () => {
    if (flashcards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % flashcards.length);
    }, 150);
  };

  const handlePrevious = () => {
    if (flashcards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
    }, 150);
  };

  const handleShuffle = () => {
    if (flashcards.length <= 1) return;
    setIsFlipped(false);
    setTimeout(() => {
      let nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * flashcards.length);
      } while (nextIndex === currentIndex);
      setCurrentIndex(nextIndex);
    }, 150);
  };

  const progressPercent = flashcards.length > 0 
    ? ((currentIndex + 1) / flashcards.length) * 100 
    : 0;

  return (
    <div className="container-fluid my-4 px-4">
      {/* HEADER ROW */}
      <header className="mb-4 d-flex justify-content-between align-items-center pb-2 border-bottom">
        <div>
          <h1 className="h4 fw-bold mb-0" style={{ color: '#3b5246' }}>
            Your Flashcard Maker <span className="text-muted fs-6 fw-normal"></span>
          </h1>
        </div>
        {flashcards.length > 0 && (
          <div className="small-indicator">
            {currentIndex + 1} / {flashcards.length}
          </div>
        )}
      </header>

      {/* WEB APPLICATION FLEX LAYOUT GRID */}
      <div className="master-flex-wrapper">
        
        {/* LEFT COLUMN: Controls & Stack Index Tracker (30%) */}
        <div className="left-control-panel">
          
          {/* Card Management Creation panel widget */}
          <div className="card studio-card overflow-hidden">
            <div className="card-header studio-header p-2">
              <ul className="nav nav-tabs border-0">
                <li className="nav-item">
                  <button 
                    className={`nav-link py-2 px-3 ${activeTab === 'ai' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ai')}
                  >
                    ✨ AI Create
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className={`nav-link py-2 px-3 ${activeTab === 'manual' ? 'active' : ''}`}
                    onClick={() => setActiveTab('manual')}
                  >
                    ✍️ Manual
                  </button>
                </li>
              </ul>
            </div>
            
            <div className="card-body p-3">
              {activeTab === 'ai' ? (
                <form onSubmit={handleGenerateAICards}>
                  {/* 4. NEW FILE UPLOAD COMPONENT ELEMENT */}
                  <div className="mb-2">
                    <label className="form-label fw-semibold small mb-1">Upload Study Document (PDF)</label>
                    <input 
                      type="file" 
                      className="form-control custom-input btn-sm" 
                      accept=".pdf" 
                      onChange={handleFileChange}
                      disabled={loading}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-semibold small mb-1">Context Notes (Optional if PDF added)</label>
                    <textarea 
                      className="form-control custom-input small" 
                      rows="3"
                      placeholder="Paste your source text or instructions here..."
                      value={aiNotes}
                      onChange={(e) => setAiNotes(e.target.value)}
                      disabled={loading}
                    ></textarea>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold small mb-1">Quantity</label>
                    <select 
                      className="form-select custom-input btn-sm"
                      placeholder="select quantity"
                      value={cardCount}
                      onChange={(e) => setCardCount(Number(e.target.value))}
                      disabled={loading}
                    >
                      <option value="10">10 Cards</option>
                      <option value="20">20 Cards</option>
                      <option value="30">30 Cards</option>
                      <option value="50">50 Cards</option>
                      <option value="60">60 Cards</option>
                      <option value="80">80 Cards</option>
                      <option value="100">100 Cards</option>
                      <option value="120">120 Cards</option>
                    </select>
                  </div>
                  {/* Button condition updated to unlock when either notes or PDF data exists */}
                  <button type="submit" className="btn btn-sage-primary w-100 py-2 small text-uppercase tracking-wider" disabled={loading || (!aiNotes.trim() && !pdfData)}>
                    {loading ? "Analyzing Document..." : "+ Generate Flashcards"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAddManualCard}>
                  <div className="mb-2">
                    <label className="form-label fw-semibold small mb-1">Question</label>
                    <input 
                      type="text" 
                      className="form-control custom-input py-1.5 small" 
                      placeholder="What do you want to learn?"
                      value={manualFront}
                      onChange={(e) => setManualFront(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold small mb-1">Answer</label>
                    <textarea 
                      className="form-control custom-input small" 
                      rows="2"
                      placeholder="What's the answer?"
                      value={manualBack}
                      onChange={(e) => setManualBack(e.target.value)}
                    ></textarea>
                  </div>
                  <button type="submit" className="btn btn-sage-primary w-100 py-2 small text-uppercase tracking-wider" disabled={!manualFront.trim() || !manualBack.trim()}>
                    + Add Card
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* YOUR CARDS INDEX FEED */}
          <div className="flex-grow-1 overflow-auto pe-1" style={{ maxHeight: '380px' }}>
            <div className="d-flex justify-content-between align-items-center mb-2 px-1">
              <span className="small text-uppercase fw-bold text-muted" style={{ fontSize: '0.7rem' }}>Your card Stack</span>
              {flashcards.length > 0 && (
                <button className="btn btn-link text-danger text-decoration-none p-0 small" style={{ fontSize: '0.75rem' }} onClick={() => { setFlashcards([]); setCurrentIndex(0); }}>Wipe Deck</button>
              )}
            </div>

            {flashcards.map((card, idx) => (
              <div 
                key={card.id} 
                className={`card-stack-item ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => { setCurrentIndex(idx); setIsFlipped(false); }}
                style={{ cursor: 'pointer' }}
              >
                <div className="fw-semibold text-truncate pe-3 small" style={{ color: '#2d3a34' }}>
                  {card.front}
                </div>
                <div className="text-muted text-truncate small" style={{ fontSize: '0.75rem' }}>
                  {card.back}
                </div>
                <button 
                  className="position-absolute border-0 bg-transparent text-muted hover-danger"
                  style={{ top: '10px', right: '10px', fontSize: '0.85rem' }}
                  onClick={(e) => handleDeleteCard(card.id, e)}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>

        </div>

        {/* RIGHT COLUMN: Interactive Presentation Card Space */}
        <div className="right-study-viewport">
          
          <div className="w-100 text-center mb-2">
            <span className="text-uppercase small tracking-wider text-muted font-monospace" style={{ fontSize: '0.75rem' }}>
              Click the card to flip 
            </span>
          </div>

          {flashcards.length === 0 ? (
            <div className="my-auto text-center py-5">
              <div className="fs-1 mb-2">🌿</div>
              <h5 className="fw-bold">No active cards found</h5>
              <p className="text-muted small mx-auto" style={{ maxWidth: '280px' }}>
                Use the creation panel on the left to create flashcards.
              </p>
            </div>
          ) : (
            <>
              {/* THE ACTIVE CINEMATIC FLIP CARD */}
              <div 
                className={`presentation-flashcard-wrapper ${isFlipped ? 'flipped' : ''}`}
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <div className="flashcard-inner">
                  {/* FRONT SIDE (QUESTION) */}
                  <div className="card-front">
                    <span className="text-uppercase small font-monospace tracking-wider text-muted mb-3" style={{ fontSize: '0.7rem' }}>Question</span>
                    <h2 className="h4 text-center px-3 fw-bold m-0" style={{ lineHeight: '1.4', color: '#2d3a34' }}>
                      {flashcards[currentIndex].front}
                    </h2>
                    <span className="text-muted small mt-4" style={{ fontSize: '0.75rem', opacity: 0.6 }}>Click to reveal solution</span>
                  </div>

                  {/* BACK SIDE (ANSWER) */}
                  <div className="card-back">
                    <span className="text-uppercase small font-monospace tracking-wider text-muted mb-3" style={{ fontSize: '0.7rem' }}>Answer Definition</span>
                    <p className="fs-5 text-center px-3 m-0" style={{ lineHeight: '1.5' }}>
                      {flashcards[currentIndex].back}
                    </p>
                    <span className="text-muted small mt-4" style={{ fontSize: '0.75rem', opacity: 0.6 }}>Click to see question</span>
                  </div>
                </div>
              </div>

              {/* PROGRESS BAR TRACKING INDICATOR LINE */}
              <div className="w-100 d-flex flex-column align-items-center">
                <div className="progress-container-bar">
                  <div className="progress-filler" style={{ width: `${progressPercent}%` }}></div>
                </div>

                {/* PRESENTATION CAROUSEL CONTROLS */}
                <div className="d-flex align-items-center gap-2">
                  <button className="btn btn-nav-outline" onClick={handlePrevious}>
                    ← Previous
                  </button>
                  <button className="btn btn-sage-primary" onClick={handleNext}>
                    Next →
                  </button>
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