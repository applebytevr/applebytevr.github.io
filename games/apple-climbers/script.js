const zip = new JSZip();
let coverFileMap = new Map(); // Map to store cover files
const warning = document.createElement("div");

// Setup warning messages
warning.style.position = "fixed";
warning.style.top = "10px";
warning.style.right = "10px";
warning.style.backgroundColor = "#e63946";
warning.style.color = "white";
warning.style.padding = "8px";
warning.style.borderRadius = "5px";
warning.style.display = "none";
warning.style.zIndex = "1000";
document.body.appendChild(warning);

// Function to show warning messages
function showWarning(message) {
    warning.textContent = message;
    warning.style.display = "block";
    setTimeout(() => (warning.style.display = "none"), 3000);
}

// Add Track Event Listener
document.getElementById("addTrack").addEventListener("click", () => {
    const trackListContainer = document.getElementById("trackList");
    const originalTrackForm = document.querySelector(".track-form");
    const newTrackForm = originalTrackForm.cloneNode(true);

    // Reset inputs in the cloned track form
    newTrackForm.querySelectorAll("input").forEach((input) => (input.value = ""));
    newTrackForm.querySelector(".coverPreview").src = "";
    newTrackForm.querySelector(".coverPreview").style.display = "none";
    newTrackForm.querySelector(".audioPreview").src = "";
    newTrackForm.querySelector(".audioPreview").style.display = "none";

    setupTrackEvents(newTrackForm, true);
    trackListContainer.appendChild(newTrackForm);
    updateDownloadButton();
});

// Setup Events for New Track Form
function setupTrackEvents(trackForm, isCloned = false) {
    const coverUploadBtn = trackForm.querySelector(".coverUploadBtn");
    const coverInput = trackForm.querySelector(".coverImage");
    const coverPreview = trackForm.querySelector(".coverPreview");

    const audioUploadBtn = trackForm.querySelector(".addAudioBtn");
    const audioInput = trackForm.querySelector(".audioFile");
    const audioPreview = trackForm.querySelector(".audioPreview");

    const songNameInput = trackForm.querySelector(".songName");
    const artistInput = trackForm.querySelector(".artist");
    const albumNameInput = trackForm.querySelector(".albumName");
    const albumYearInput = trackForm.querySelector(".albumYear");
    const genreInput = trackForm.querySelector(".genre");

    let audioUploaded = false;

    // Disable inputs initially
    disableInputs();

    // Cover Upload
    coverUploadBtn.addEventListener("click", () => {
        if (!audioUploaded) {
            showWarning("Please upload an audio file first!");
            return;
        }
        coverInput.click();
    });
    coverInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) {
            coverPreview.src = URL.createObjectURL(file);
            coverPreview.style.display = "block";
            coverFileMap.set(trackForm, file);
        }
    });

    // Audio Upload with Metadata Extraction
    audioUploadBtn.addEventListener("click", () => audioInput.click());
    audioInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            audioPreview.src = URL.createObjectURL(file);
            audioPreview.style.display = "block";
            audioUploaded = true;
            enableInputs();

            window.jsmediatags.read(file, {
                onSuccess: (tag) => {
                    const metadata = tag.tags;

                    if (metadata.title) songNameInput.value = metadata.title;
                    if (metadata.artist) artistInput.value = metadata.artist;
                    if (metadata.album) albumNameInput.value = metadata.album;
                    if (metadata.year) albumYearInput.value = metadata.year;
                    if (metadata.genre) genreInput.value = metadata.genre;

                    // Only set cover if picture metadata exists
                    if (metadata.picture) {
                        const { data, format } = metadata.picture;
                        const blob = new Blob([new Uint8Array(data)], { type: format });
                        coverPreview.src = URL.createObjectURL(blob);
                        coverPreview.style.display = "block";
                        coverFileMap.set(trackForm, blob);
                    }
                },
                onError: () => {
                    console.error("Metadata extraction failed.");
                },
            });
        }
    });

    function disableInputs() {
        [songNameInput, artistInput, albumNameInput, albumYearInput, genreInput].forEach(
            (input) => {
                input.disabled = true;
            }
        );
    }

    function enableInputs() {
        [songNameInput, artistInput, albumNameInput, albumYearInput, genreInput].forEach(
            (input) => {
                input.disabled = false;
            }
        );
    }

    // Remove Button for Cloned Tracks
    if (isCloned) {
        let removeBtn = document.createElement("button");
        removeBtn.textContent = "−";
        removeBtn.classList.add("removeTrackBtn");
        removeBtn.style.position = "absolute";
        removeBtn.style.top = "-12px";
        removeBtn.style.right = "-12px";
        trackForm.appendChild(removeBtn);

        removeBtn.addEventListener("click", () => {
            trackForm.remove();
            coverFileMap.delete(trackForm);
            updateDownloadButton();
        });
    }
}

// Update "Download" button text
function updateDownloadButton() {
    const trackForms = document.querySelectorAll(".track-form");
    const downloadBtn = document.getElementById("downloadAll");
    downloadBtn.textContent =
        trackForms.length === 1 ? "Download Track" : "Download All Tracks";
}

// Download All Tracks as ZIP
document.getElementById("downloadAll").addEventListener("click", async () => {
    const trackForms = document.querySelectorAll(".track-form");
    if (trackForms.length === 0) {
        showWarning("No tracks available to download.");
        return;
    }

    let mainZip = new JSZip();
    const singleTrack = trackForms.length === 1;

    for (const [index, trackForm] of Array.from(trackForms).entries()) {
        const trackNumber = index + 1; // Number the tracks (1, 2, 3, ...)
        const name = trackForm.querySelector(".songName").value.trim();
        const artist = trackForm.querySelector(".artist").value.trim();
        const albumName = trackForm.querySelector(".albumName").value.trim();
        const albumYear = trackForm.querySelector(".albumYear").value.trim();
        const genre = trackForm.querySelector(".genre").value.trim();
        const audioFile = trackForm.querySelector(".audioFile").files[0];
        const coverFile = coverFileMap.get(trackForm);

        // Validation
        if (!audioFile) {
            showWarning(`Audio file missing for track ${trackNumber}.`);
            return;
        }

        if (!name || !artist || !albumName || !albumYear || !genre) {
            showWarning(`Incomplete information for track ${trackNumber}.`);
            return;
        }

        if (!coverFile) {
            showWarning(`Cover image missing for track ${trackNumber}.`);
            return;
        }

        // Create folder structure with numbering for multi-track ZIPs
        const folderName = `${trackNumber}. ${artist} - ${name}`;
        const folder = mainZip.folder(folderName);

        // Add audio, cover, and info.json to the folder
        folder.file("track.mp3", audioFile);
        folder.file("cover.png", coverFile);

        // Generate JSON with added album year and genre
        const trackInfo = {
            name,
            artist,
            albumName,
            albumYear,
            genre,
        };

        folder.file("info.json", JSON.stringify(trackInfo, null, 4)); // Pretty format JSON
    }

    // ZIP naming convention
    const firstTrack = trackForms[0];
    const artist = firstTrack.querySelector(".artist").value.trim();
    const albumName = firstTrack.querySelector(".albumName").value.trim();
    const zipName = singleTrack ? `${artist} - ${name}.zip` : `${artist} - ${albumName}.zip`;

    // Generate and download ZIP
    try {
        const content = await mainZip.generateAsync({ type: "blob" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(content);
        a.download = zipName;
        a.click();
    } catch (error) {
        showWarning("Error generating ZIP file.");
        console.error("ZIP Generation Error:", error);
    }
});

// Initialize Track Events for the First Form
setupTrackEvents(document.querySelector(".track-form"));
updateDownloadButton();
