// --- Game Setup ---
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const scoreDisplay = document.getElementById('score');
        const highScoreDisplay = document.getElementById('highScore');
        const messageBox = document.getElementById('messageBox');
        const messageText = document.getElementById('messageText');
        const restartButton = document.getElementById('restartButton');
        const powerUpIndicator = document.getElementById('powerUpIndicator');

        // --- Game Variables ---
        const gravity = 0.6;
        let gameSpeed = 5;
        let originalGameSpeed = gameSpeed; // Store original speed for slow-motion
        let score = 0;
        let highScore = localStorage.getItem('darkRunnerHighScore') || 0;
        let gameOver = false;
        let frame = 0;
        let obstacles = [];
        let powerUps = [];

        // Player (Bird)
        const bird = {
            x: 50,
            y: canvas.height / 2,
            width: 50, /* Slightly larger for more detail */
            height: 45,
            velocityY: 0,
            invincible: false,
            shielded: false,
            invisibleEffect: false // For visual glitch effect
        };

        // Background elements (for parallax effect)
        const backgroundElements = []; 

        function createBackgroundElements() {
            // Clear existing elements
            backgroundElements.length = 0; // Efficient way to clear array

            // Create multiple layers of background elements
            // Layer 1: Distant spires (slowest)
            for (let i = 0; i < 8; i++) {
                backgroundElements.push({
                    x: Math.random() * canvas.width * 2,
                    y: canvas.height - (Math.random() * 50 + 100),
                    width: Math.random() * 80 + 120,
                    height: Math.random() * 100 + 200,
                    opacity: Math.random() * 0.05 + 0.02, /* Very faint */
                    speedMultiplier: 0.05,
                    color: 'rgba(5, 0, 10, 1)', /* Deepest blue/black */
                    shape: 'spire',
                    swayOffset: Math.random() * Math.PI * 2
                });
            }
            // Layer 2: Mid-distance ominous shapes (medium speed)
            for (let i = 0; i < 10; i++) {
                backgroundElements.push({
                    x: Math.random() * canvas.width * 2,
                    y: canvas.height - (Math.random() * 30 + 80),
                    width: Math.random() * 50 + 90,
                    height: Math.random() * 70 + 150,
                    opacity: Math.random() * 0.1 + 0.05, /* Faint */
                    speedMultiplier: 0.1,
                    color: 'rgba(10, 0, 20, 1)', /* Dark blue/purple */
                    shape: 'mist',
                    swayOffset: Math.random() * Math.PI * 2
                });
            }
            // Layer 3: Closer, swirling mist (faster)
            for (let i = 0; i < 12; i++) {
                backgroundElements.push({
                    x: Math.random() * canvas.width * 2,
                    y: canvas.height - (Math.random() * 20 + 50),
                    width: Math.random() * 30 + 70,
                    height: Math.random() * 40 + 100,
                    opacity: Math.random() * 0.15 + 0.1, /* More visible */
                    speedMultiplier: 0.2,
                    color: 'rgba(15, 0, 30, 1)', /* Purple/indigo */
                    shape: 'swirl',
                    swayOffset: Math.random() * Math.PI * 2
                });
            }
        }

        // Adjust canvas size dynamically
        const setCanvasSize = () => {
            canvas.width = Math.min(window.innerWidth * 0.8, 800);
            canvas.height = Math.min(window.innerHeight * 0.7, 500);
            // Recreate background elements on resize to fit new canvas dimensions
            createBackgroundElements();
        };
        window.addEventListener('resize', setCanvasSize);
        setCanvasSize(); // Initial set (now backgroundElements is guaranteed to be initialized)


        // --- Tone.js Sound Setup ---
        let audioContextReady = false;

        async function initializeAudio() {
            if (!audioContextReady) {
                try {
                    await Tone.start();
                    console.log('Tone.js audio context started and running.');
                    audioContextReady = true;
                } catch (e) {
                    console.error('Failed to start Tone.js audio context:', e);
                    audioContextReady = false;
                }
            }
        }

        // Attach listeners for user interaction to start audio
        document.documentElement.addEventListener('mousedown', initializeAudio, { once: true });
        document.documentElement.addEventListener('keydown', initializeAudio, { once: true });

        // Jump sound: Ethereal and impactful
        let jumpSynth = new Tone.Synth({
            oscillator: { type: "sine" },
            envelope: {
                attack: 0.01,
                decay: 0.2,
                sustain: 0.0,
                release: 0.3
            },
            volume: -15
        }).toDestination();

        // Hit sound: Deeper, more unsettling with reverb
        let hitSynth = new Tone.NoiseSynth({
            noise: { type: "brown" },
            envelope: {
                attack: 0.005,
                decay: 0.4,
                sustain: 0.0,
                release: 0.2
            },
            volume: -8
        }).connect(new Tone.Reverb(1).toDestination());

        // Power-up collection sound: Chilling with longer decay
        let powerUpSynth = new Tone.MembraneSynth({
            pitchDecay: 0.08,
            octaves: 6,
            envelope: {
                attack: 0.001,
                decay: 0.8,
                sustain: 0.01,
                release: 0.3
            },
            volume: -10
        }).toDestination();

        // New: Slow motion sound (sustained, low drone)
        let slowMotionSynth = new Tone.Synth({
            oscillator: { type: "triangle" },
            envelope: {
                attack: 0.1,
                decay: 0.5,
                sustain: 0.8,
                release: 0.5
            },
            volume: -18,
            detune: -100 // Slightly detuned for eerie feel
        }).toDestination();

        // New: Obstacle destroy sound (sharp, explosive)
        let destroySynth = new Tone.MetalSynth({
            frequency: 200,
            envelope: {
                attack: 0.001,
                decay: 0.1,
                sustain: 0.0,
                release: 0.05
            },
            harmonicity: 3.1,
            modulationIndex: 23,
            resonance: 4000,
            octaves: 1.5,
            volume: -10
        }).toDestination();


        // --- Game Functions ---

        function drawBird() {
            ctx.save();
            if (bird.invisibleEffect) {
                ctx.globalAlpha = 0.4 + Math.sin(frame * 0.1) * 0.1; /* Pulsating transparency */
                canvas.classList.add('glitch');
                ctx.strokeStyle = '#00ffff'; /* Icy blue outline */
                ctx.lineWidth = 3; /* Thicker outline */
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur = 20; /* More intense glow */
            } else {
                ctx.globalAlpha = 1.0;
                canvas.classList.remove('glitch');
                ctx.shadowBlur = 0;
            }

            // Ethereal ghost-like shape (multiple layers)
            // Layer 1: Core body (slightly opaque)
            ctx.fillStyle = 'rgba(170, 200, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(bird.x + bird.width / 2, bird.y + bird.height / 2, bird.width * 0.4, 0, Math.PI * 2);
            ctx.fill();

            // Layer 2: Wispy aura
            ctx.fillStyle = 'rgba(170, 200, 255, 0.2)';
            ctx.beginPath();
            ctx.ellipse(bird.x + bird.width / 2, bird.y + bird.height / 2, bird.width * 0.5, bird.height * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();

            // Wispy tail (more pronounced)
            ctx.fillStyle = 'rgba(170, 200, 255, 0.3)';
            ctx.beginPath();
            ctx.moveTo(bird.x + bird.width * 0.4, bird.y + bird.height * 0.8);
            ctx.bezierCurveTo(
                bird.x + bird.width * 0.2, bird.y + bird.height * 1.2,
                bird.x + bird.width * 0.8, bird.y + bird.height * 1.2,
                bird.x + bird.width * 0.6, bird.y + bird.height * 0.8
            );
            ctx.lineTo(bird.x + bird.width * 0.5, bird.y + bird.height * 1.5 + Math.sin(frame * 0.15) * 5); /* Subtle bob */
            ctx.bezierCurveTo(
                bird.x + bird.width * 0.3, bird.y + bird.height * 1.8,
                bird.x + bird.width * 0.7, bird.y + bird.height * 1.8,
                bird.x + bird.width * 0.5, bird.y + bird.height * 1.5 + Math.sin(frame * 0.15) * 5
            );
            ctx.closePath();
            ctx.fill();

            // Draw outline if invisible
            if (bird.invisibleEffect) {
                ctx.stroke();
            }

            // Chilling blue eyes (more intense glow)
            ctx.fillStyle = '#33ccff';
            ctx.shadowColor = '#33ccff';
            ctx.shadowBlur = 12; /* Stronger glow */
            ctx.beginPath();
            ctx.arc(bird.x + bird.width * 0.35, bird.y + bird.height * 0.35, 4, 0, Math.PI * 2); /* Larger eyes */
            ctx.arc(bird.x + bird.width * 0.65, bird.y + bird.height * 0.35, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;

            if (bird.shielded) {
                // Draw a pulsating red shield
                ctx.strokeStyle = '#ff3333';
                ctx.lineWidth = 6;
                ctx.shadowColor = '#ff0000';
                ctx.shadowBlur = 25 + Math.sin(frame * 0.15) * 15; /* More pronounced pulsating blur */
                ctx.beginPath();
                ctx.arc(bird.x + bird.width / 2, bird.y + bird.height / 2, bird.width * 0.75, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();
        }

        class Obstacle {
            constructor() {
                this.width = Math.random() * 60 + 90; /* Even larger, more imposing */
                this.height = Math.random() * 120 + 150;
                this.x = canvas.width;
                const topOrBottom = Math.random() > 0.5;
                if (topOrBottom) {
                    this.y = 0;
                    this.height = Math.random() * (canvas.height / 2) + 120;
                } else {
                    this.y = canvas.height - this.height;
                    this.height = Math.random() * (canvas.height / 2) + 120;
                }
                this.colorBase = '#200020'; /* Deeper purple/black base */
                this.colorHighlight = '#800080'; /* Vivid magenta/purple highlight */
                this.colorGlow = '#ff00ff'; /* Bright magenta glow */
            }

            draw() {
                ctx.save();
                const gradient = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y + this.height);
                gradient.addColorStop(0, this.colorBase);
                gradient.addColorStop(0.5, this.colorHighlight);
                gradient.addColorStop(1, '#100010');
                ctx.fillStyle = gradient;

                ctx.shadowColor = this.colorGlow;
                ctx.shadowBlur = 15; /* Stronger glow for obstacles */

                ctx.beginPath();
                // More complex, jagged, crystalline shape
                ctx.moveTo(this.x, this.y + this.height * 0.3);
                ctx.lineTo(this.x + this.width * 0.2, this.y);
                ctx.lineTo(this.x + this.width * 0.6, this.y + this.height * 0.08);
                ctx.lineTo(this.x + this.width, this.y + this.height * 0.4);
                ctx.lineTo(this.x + this.width * 0.9, this.y + this.height * 0.8);
                ctx.lineTo(this.x + this.width * 0.5, this.y + this.height);
                ctx.lineTo(this.x + this.width * 0.15, this.y + this.height * 0.7);
                ctx.closePath();
                ctx.fill();

                // Add deep cracks/details
                ctx.strokeStyle = '#050005'; /* Even darker */
                ctx.lineWidth = 4; /* Thicker cracks */
                ctx.beginPath();
                ctx.moveTo(this.x + this.width * 0.4, this.y + this.height * 0.2);
                ctx.lineTo(this.x + this.width * 0.7, this.y + this.height * 0.6);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(this.x + this.width * 0.1, this.y + this.height * 0.5);
                ctx.lineTo(this.x + this.width * 0.8, this.y + this.height * 0.2);
                ctx.stroke();

                ctx.restore();
            }

            update() {
                this.x -= gameSpeed;
                this.draw();
            }
        }

        class PowerUp {
            constructor(type) {
                this.width = 30; /* Slightly larger power-ups */
                this.height = 30;
                this.x = canvas.width;
                this.y = Math.random() * (canvas.height - 100) + 50;
                this.type = type;
                this.color = this.getColor(type);
                this.duration = 5000;
            }

            getColor(type) {
                switch (type) {
                    case 'speed': return '#00ff00';
                    case 'invisible': return '#00ffff';
                    case 'shield': return '#ffcc00';
                    case 'slow': return '#9933ff'; /* Purple for slow */
                    case 'destroy': return '#ff6600'; /* Orange for destroy */
                    default: return '#ffffff';
                }
            }

            draw() {
                ctx.save();
                ctx.fillStyle = this.color;
                ctx.shadowColor = this.color;
                ctx.shadowBlur = 15 + Math.sin(frame * 0.1) * 5; /* Subtle pulse glow */
                ctx.beginPath();
                ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
                ctx.fill();

                ctx.shadowBlur = 0;

                ctx.fillStyle = '#000000';
                ctx.font = '20px "Creepster", cursive'; /* Larger, scary font for symbols */
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                let symbol;
                switch (this.type) {
                    case 'speed': symbol = '⚡'; break;
                    case 'invisible': symbol = '👻'; break;
                    case 'shield': symbol = '🛡️'; break;
                    case 'slow': symbol = '⏳'; break; /* Clock emoji */
                    case 'destroy': symbol = '💥'; break; /* Explosion emoji */
                    default: symbol = '?';
                }
                ctx.fillText(symbol, this.x + this.width / 2, this.y + this.height / 2);
                ctx.restore();
            }

            update() {
                this.x -= gameSpeed;
                this.draw();
            }
        }

        function checkCollision(obj1, obj2) {
            // Slightly adjusted hitbox for the bird to make collisions feel more accurate
            const birdHitboxX = bird.x + 5; // Nudge right
            const birdHitboxY = bird.y + 5; // Nudge down
            const birdHitboxWidth = bird.width - 10; // Slightly smaller width
            const birdHitboxHeight = bird.height - 10; // Slightly smaller height

            return birdHitboxX < obj2.x + obj2.width &&
                   birdHitboxX + birdHitboxWidth > obj2.x &&
                   birdHitboxY < obj2.y + obj2.height &&
                   birdHitboxY + birdHitboxHeight > obj2.y;
        }

        function activatePowerUp(type) {
            if (audioContextReady && Tone.context.state === 'running') {
                powerUpSynth.triggerAttackRelease('C5', '8n');
            }
            powerUpIndicator.style.display = 'block';
            powerUpIndicator.textContent = `Power-up: ${type.toUpperCase()}`;

            switch (type) {
                case 'speed':
                    const originalSpeedBoost = gameSpeed;
                    gameSpeed *= 1.5;
                    setTimeout(() => {
                        gameSpeed = originalSpeedBoost;
                        powerUpIndicator.style.display = 'none';
                    }, 7000);
                    break;
                case 'invisible':
                    bird.invincible = true;
                    bird.invisibleEffect = true;
                    setTimeout(() => {
                        bird.invincible = false;
                        bird.invisibleEffect = false;
                        powerUpIndicator.style.display = 'none';
                    }, 5000);
                    break;
                case 'shield':
                    bird.shielded = true;
                    setTimeout(() => {
                        bird.shielded = false;
                        powerUpIndicator.style.display = 'none';
                    }, 10000);
                    break;
                case 'slow':
                    // Store the current base speed before slowing down
                    const currentBaseGameSpeed = gameSpeed;
                    gameSpeed = originalGameSpeed * 0.5; // Slow down to 50% of original base speed
                    canvas.classList.add('slow-motion'); // Add visual effect

                    if (audioContextReady && Tone.context.state === 'running') {
                        slowMotionSynth.triggerAttackRelease('C3', '8n', Tone.now(), 0.5); // Start playing a low drone
                    }

                    setTimeout(() => {
                        gameSpeed = currentBaseGameSpeed; // Revert to speed before slow motion
                        canvas.classList.remove('slow-motion'); // Remove visual effect
                        if (audioContextReady && Tone.context.state === 'running') {
                            slowMotionSynth.triggerRelease(); // Stop the drone
                        }
                        powerUpIndicator.style.display = 'none';
                    }, 6000); // 6 seconds duration
                    break;
                case 'destroy':
                    if (audioContextReady && Tone.context.state === 'running') {
                        destroySynth.triggerAttackRelease('C4', '0.2s'); // Play explosion sound
                    }
                    canvas.classList.add('destroy-flash'); // Add visual flash effect
                    obstacles = []; // Clear all obstacles on screen
                    setTimeout(() => {
                        canvas.classList.remove('destroy-flash'); // Remove flash effect
                        powerUpIndicator.style.display = 'none';
                    }, 500); // Very short flash duration
                    break;
            }
        }

        function showMessage(text) {
            messageText.textContent = text;
            messageBox.style.display = 'block';
        }

        function hideMessage() {
            messageBox.style.display = 'none';
        }

        function restartGame() {
            hideMessage();
            gameSpeed = originalGameSpeed; // Reset to original base speed
            score = 0;
            bird.y = canvas.height / 2;
            bird.velocityY = 0;
            bird.invincible = false;
            bird.shielded = false;
            bird.invisibleEffect = false;
            obstacles = [];
            powerUps = [];
            gameOver = false;
            frame = 0;
            scoreDisplay.textContent = score;
            highScoreDisplay.textContent = highScore;
            powerUpIndicator.style.display = 'none';
            canvas.classList.remove('slow-motion', 'destroy-flash'); // Clean up any visual effects
            animate();
        }

        function endGame() {
            gameOver = true;
            if (audioContextReady && Tone.context.state === 'running') {
                hitSynth.triggerAttackRelease('C2', '4n');
            }
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('darkRunnerHighScore', highScore);
                showMessage(`Game Over! New High Score: ${highScore}`);
            } else {
                showMessage(`Game Over! Score: ${score}`);
            }
        }

        // --- Game Loop ---
        function animate() {
            if (gameOver) {
                return;
            }

            requestAnimationFrame(animate);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            frame++;

            // Draw and update background elements for parallax
            for (let i = 0; i < backgroundElements.length; i++) {
                const bg = backgroundElements[i];
                ctx.save();

                // Ominous, distorted background shapes
                const gradient = ctx.createLinearGradient(bg.x, bg.y, bg.x + bg.width, bg.y + bg.height);
                gradient.addColorStop(0, bg.color);
                gradient.addColorStop(1, 'rgba(0,0,0,0)'); // Fade out to black

                ctx.fillStyle = `rgba(${parseInt(bg.color.slice(5, 8))}, ${parseInt(bg.color.slice(9, 12))}, ${parseInt(bg.color.slice(13, 15))}, ${bg.opacity + Math.sin(frame * 0.01 * bg.speedMultiplier + bg.swayOffset) * 0.03})`; /* Subtle pulse based on speed */

                ctx.beginPath();
                if (bg.shape === 'spire') {
                    ctx.moveTo(bg.x + bg.width / 2, bg.y);
                    ctx.lineTo(bg.x, bg.y + bg.height);
                    ctx.lineTo(bg.x + bg.width, bg.y + bg.height);
                    ctx.closePath();
                    ctx.fill();
                } else if (bg.shape === 'mist') {
                    ctx.ellipse(bg.x + bg.width / 2, bg.y + bg.height / 2, bg.width / 2, bg.height / 3, Math.sin(frame * 0.005 * bg.speedMultiplier) * 0.2, 0, Math.PI * 2);
                    ctx.fill();
                } else if (bg.shape === 'swirl') {
                    ctx.moveTo(bg.x, bg.y);
                    ctx.bezierCurveTo(
                        bg.x + bg.width * 0.8, bg.y - bg.height * 0.5,
                        bg.x - bg.width * 0.3, bg.y + bg.height * 1.2,
                        bg.x + bg.width, bg.y + bg.height
                    );
                    ctx.bezierCurveTo(
                        bg.x - bg.width * 0.5, bg.y + bg.height * 0.8,
                        bg.x + bg.width * 0.2, bg.y - bg.height * 0.2,
                        bg.x, bg.y
                    );
                    ctx.closePath();
                    ctx.fill();
                }

                ctx.restore();

                bg.x -= gameSpeed * bg.speedMultiplier;
                // Reset position when off-screen
                if (bg.x + bg.width < 0) {
                    bg.x = canvas.width + Math.random() * canvas.width * 0.5; // Reset closer to screen edge for continuous flow
                    bg.y = canvas.height - (Math.random() * 80 + 120);
                    bg.width = Math.random() * 25 + 35;
                    bg.height = Math.random() * 60 + 120;
                    bg.opacity = Math.random() * 0.15 + 0.08;
                    bg.speedMultiplier = Math.random() * 0.1 + 0.03;
                    bg.swayOffset = Math.random() * Math.PI * 2;
                }
            }


            // Bird update
            bird.velocityY += gravity;
            bird.y += bird.velocityY;

            // Prevent bird from going below ground or above ceiling
            if (bird.y + bird.height > canvas.height) {
                bird.y = canvas.height - bird.height;
                bird.velocityY = 0;
            }
            if (bird.y < 0) {
                bird.y = 0;
                bird.velocityY = 0;
            }

            drawBird();

            // Obstacle generation
            if (frame % 90 === 0) {
                obstacles.push(new Obstacle());
            }

            // Power-up generation (less frequent)
            if (frame % 500 === 0 && Math.random() < 0.6) {
                const types = ['speed', 'invisible', 'shield', 'slow', 'destroy']; // Added new power-up types
                const randomType = types[Math.floor(Math.random() * types.length)];
                powerUps.push(new PowerUp(randomType));
            }

            // Update and draw obstacles - iterate backwards for safe removal
            for (let i = obstacles.length - 1; i >= 0; i--) {
                let ob = obstacles[i];
                ob.update();

                // Collision detection with bird
                if (checkCollision(bird, ob)) {
                    if (bird.invincible) {
                        obstacles.splice(i, 1);
                        continue;
                    } else if (bird.shielded) {
                        bird.shielded = false;
                        obstacles.splice(i, 1);
                        powerUpIndicator.style.display = 'none';
                        if (audioContextReady && Tone.context.state === 'running') {
                            hitSynth.triggerAttackRelease('A2', '8n');
                        }
                        continue;
                    } else {
                        endGame();
                    }
                }

                // Remove off-screen obstacles and increase score
                if (ob.x + ob.width < 0) {
                    obstacles.splice(i, 1);
                    score++;
                    scoreDisplay.textContent = score;
                }
            }

            // Update and draw power-ups - iterate backwards for safe removal
            for (let i = powerUps.length - 1; i >= 0; i--) {
                let pu = powerUps[i];
                pu.update();

                // Collision detection with bird for power-ups
                if (checkCollision(bird, pu)) {
                    activatePowerUp(pu.type);
                    powerUps.splice(i, 1);
                }

                // Remove off-screen power-ups
                if (pu.x + pu.width < 0) {
                    powerUps.splice(i, 1);
                }
            }

            // Increase game speed gradually (only if not in slow motion)
            if (gameSpeed === originalGameSpeed || gameSpeed > originalGameSpeed) { // Prevent increasing speed if currently slowed
                gameSpeed += 0.0005;
            }
        }

        // --- Event Listeners ---
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !gameOver) {
                bird.velocityY = -10;
                if (audioContextReady && Tone.context.state === 'running') {
                    jumpSynth.triggerAttackRelease('C4', '16n');
                }
            }
        });

        canvas.addEventListener('mousedown', () => {
            if (!gameOver) {
                bird.velocityY = -10;
                if (audioContextReady && Tone.context.state === 'running') {
                    jumpSynth.triggerAttackRelease('C4', '16n');
                }
            }
        });

        restartButton.addEventListener('click', restartGame);

        // Initial setup and start game
        window.onload = function () {
            highScoreDisplay.textContent = highScore;
            animate();
        }
        function endGame() {
            gameOver = true;
            if (audioContextReady && Tone.context.state === 'running') {
                hitSynth.triggerAttackRelease('C2', '4n');
            }
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('darkRunnerHighScore', highScore);
                showMessage(`Game Over! New High Score: ${highScore}`);
            } else {
                showMessage(`Game Over! Score: ${score}`);
            }
        }
        function showMessage(text) {
            messageText.textContent = text;
            messageBox.style.display = 'block';
        }
        