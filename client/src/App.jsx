import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactAudioPlayer from "react-audio-player";
import {
	AspectRatio,
	Box,
	Card,
	CardActions,
	CardContent,
	Typography,
	Button,
	Input,
	CircularProgress,
	Avatar,
	Modal,
	List,
	ListItem,
	ListItemButton,
	ListItemContent,
} from "@mui/joy";
import { Pause, PlayArrow, ExitToApp } from "@mui/icons-material";
import { clientId, redirectUri } from "./constants";
import { Toaster, toast } from "react-hot-toast";
import "@fontsource/inter";

function App() {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState([]);
	const [loading, setLoading] = useState(false);
	const [accessToken, setAccessToken] = useState(localStorage.getItem("accessToken"));
	const [similarSongs, setSimilarSongs] = useState([]);
	const [playingTrackId, setPlayingTrackId] = useState(null);
	const [userProfile, setUserProfile] = useState(null);
	const [playlists, setPlaylists] = useState([]);
	const [selectedSong, setSelectedSong] = useState(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [playlistQuery, setPlaylistQuery] = useState("");

	const audioRefs = useRef({});

	const fetchUserProfile = useCallback(async (token) => {
		try {
			const response = await fetch("https://api.spotify.com/v1/me", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});
			if (!response.ok) {
				if (response.status === 401) {
					handleLogout();
					toast.error("Session expired. Please log in again.");
				} else {
					throw new Error("Failed to fetch user profile");
				}
			} else {
				const data = await response.json();
				setUserProfile(data);
				fetchUserPlaylists(token);
			}
		} catch (error) {
			console.error("Error fetching user profile:", error);
			toast.error("Error fetching user profile");
		}
	}, []);

	useEffect(() => {
		const hash = window.location.hash;
		if (hash) {
			const token = new URLSearchParams(hash.substring(1)).get("access_token");
			setAccessToken(token);
			localStorage.setItem("accessToken", token);
			window.location.hash = "";
			fetchUserProfile(token);
			toast.success("Logged in successfully!");
		} else if (accessToken) {
			fetchUserProfile(accessToken);
		}
	}, [accessToken, fetchUserProfile]);

	const fetchUserPlaylists = async (token) => {
		try {
			const response = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});
			if (!response.ok) {
				throw new Error("Failed to fetch user playlists");
			}
			const data = await response.json();
			setPlaylists(data.items);
		} catch (error) {
			console.error("Error fetching user playlists:", error);
			toast.error("Error fetching user playlists");
		}
	};

	const handleLogin = () => {
		const scopes =
			"user-read-private user-read-email playlist-modify-public playlist-modify-private playlist-read-private playlist-read-collaborative";

		const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(
			redirectUri
		)}&scope=${encodeURIComponent(scopes)}`;

		window.location.href = authUrl;
	};

	const handleLogout = () => {
		setAccessToken(null);
		setUserProfile(null);
		localStorage.removeItem("accessToken");
		setPlaylists([]);
		setResults([]);
		setSimilarSongs([]);
		toast.success("Logged out successfully!");
	};

	const handleSearch = async () => {
		if (!accessToken) {
			toast.error("Please log in to Spotify first.");
			return;
		}

		setResults([]);
		setLoading(true);

		try {
			const response = await fetch(
				`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
				{
					headers: {
						Authorization: `Bearer ${accessToken}`,
					},
				}
			);

			if (!response.ok) {
				throw new Error("Failed to fetch data from Spotify");
			}

			const data = await response.json();
			const tracks = data.tracks.items.map((item) => ({
				id: item.id,
				name: item.name,
				artist: item.artists.map((artist) => artist.name).join(", "),
				image: item.album.images[0]?.url,
				previewUrl: item.preview_url,
				spotifyUrl: item.external_urls.spotify,
			}));

			setResults(tracks);
		} catch (error) {
			toast.error(error.message);
		} finally {
			setLoading(false);
		}
	};

	const handleFindSimilar = async (trackId) => {
		if (!accessToken) {
			toast.error("Please log in to Spotify first.");
			return;
		}

		setSimilarSongs([]);
		setLoading(true);

		try {
			const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			});

			if (!trackResponse.ok) {
				throw new Error("Failed to fetch track details");
			}

			const trackData = await trackResponse.json();
			const artistId = trackData.artists[0].id;

			const artistResponse = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			});

			if (!artistResponse.ok) {
				throw new Error("Failed to fetch artist details");
			}

			const artistData = await artistResponse.json();
			const genres = artistData.genres.slice(0, 3).join(",");

			const recommendationsResponse = await fetch(
				`https://api.spotify.com/v1/recommendations?seed_tracks=${trackId}&seed_genres=${genres}&seed_artist=${artistId}&limit=10`,
				{
					headers: {
						Authorization: `Bearer ${accessToken}`,
					},
				}
			);

			if (!recommendationsResponse.ok) {
				throw new Error("Failed to fetch similar songs");
			}

			const recommendationsData = await recommendationsResponse.json();
			const similarTracks = recommendationsData.tracks.map((item) => ({
				id: item.id,
				name: item.name,
				artist: item.artists.map((artist) => artist.name).join(", "),
				image: item.album.images[0]?.url,
				previewUrl: item.preview_url,
				spotifyUrl: item.external_urls.spotify,
			}));

			setSimilarSongs(similarTracks);
			toast.success("Similar songs found!");
		} catch (error) {
			toast.error(error.message);
		} finally {
			setLoading(false);
		}
	};

	const handlePlayPause = (trackId) => {
		if (playingTrackId === trackId) {
			audioRefs.current[trackId].audioEl.current.pause();
			setPlayingTrackId(null);
		} else {
			if (playingTrackId && audioRefs.current[playingTrackId]) {
				audioRefs.current[playingTrackId].audioEl.current.pause();
			}
			audioRefs.current[trackId].audioEl.current.play();
			setPlayingTrackId(trackId);
		}
	};

	const handleAddToPlaylist = (song) => {
		setSelectedSong(song);
		setIsModalOpen(true);
	};

	const handleSelectPlaylist = async (playlistId) => {
		try {
			const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					uris: [`spotify:track:${selectedSong.id}`],
				}),
			});

			if (!response.ok) {
				if (response.status === 403) {
					throw new Error("You don't have permission to add tracks to this playlist.");
				} else {
					throw new Error("Failed to add song to playlist");
				}
			}

			setIsModalOpen(false);
			setSelectedSong(null);
			toast.success("Song added to playlist successfully");
		} catch (error) {
			toast.error(error.message);
		}
	};

	const handlePlaylistSearch = async (query) => {
		try {
			const response = await fetch(`https://api.spotify.com/v1/me/playlists?limit=10`, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			});

			if (!response.ok) {
				throw new Error("Failed to search playlists");
			}

			const data = await response.json();
			const filteredPlaylists = data.items.filter((playlist) =>
				playlist.name.toLowerCase().includes(query.toLowerCase())
			);
			setPlaylists(filteredPlaylists);
		} catch (error) {
			toast.error(error.message);
		}
	};

	return (
		<div className="App p-4">
			<Toaster position="top-center" reverseOrder={false} />
			<div className="flex justify-between items-center mb-4">
				<h1 className="text-2xl font-bold p-4">AllTheRelevantMusic</h1>
				<div className="flex items-center border p-2 rounded-md gap-3">
					{userProfile ? (
						<>
							<Avatar src={userProfile.images?.[0]?.url} alt={userProfile.display_name} />
							<Typography level="body-md" className="ml-2 mr-4">
								{userProfile.display_name}
							</Typography>
							<Button
								variant="outlined"
								color="primary"
								onClick={handleLogout}
								startDecorator={<ExitToApp />}
								className="ml-2"
							>
								Log out
							</Button>
						</>
					) : (
						<Button variant="outlined" color="primary" onClick={handleLogin}>
							Log in with Spotify
						</Button>
					)}
				</div>
			</div>
			{accessToken && (
				<div className="flex flex-auto w-full justify-center gap-2 mb-4">
					<Input
						placeholder="Search for a song"
						size="lg"
						variant="outlined"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
					<Button variant="outlined" color="primary" onClick={handleSearch} className="mt-2">
						Search
					</Button>
				</div>
			)}
			{loading && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<CircularProgress size="lg" />
				</div>
			)}
			<Box display="flex" flexWrap="wrap" justifyContent="center" overflow="visible" gap="10px">
				{results.map((song) => (
					<Card size="lg" variant="soft" key={song.id} sx={{ width: 320 }}>
						<AspectRatio minHeight="120px" maxHeight="200px" position="relative">
							<img src={song.image} alt={song.name} />
							{song.previewUrl ? (
								<button
									className="absolute bottom-[10px] right-[10px] bg-white rounded-full w-10 h-10 text-black outline outline-1 outline-black"
									onClick={() => handlePlayPause(song.id)}
								>
									{playingTrackId === song.id ? <Pause /> : <PlayArrow />}
								</button>
							) : (
								<h3 className="text-lg absolute bottom-[10px] right-[10px] bg-white font-bold py-1 px-2 rounded-md">
									No Preview
								</h3>
							)}
						</AspectRatio>
						<CardContent>
							<div>
								<Typography level="h4">
									<a
										href={song.spotifyUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="no-underline hover:underline hover:cursor-pointer"
									>
										{song.name}
									</a>
								</Typography>
								<Typography level="body-md">{song.artist}</Typography>
							</div>
							<CardActions sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
								<Button variant="solid" color="primary" className="w-full" onClick={() => handleFindSimilar(song.id)}>
									Find Similar
								</Button>
								<Button variant="solid" color="primary" className="w-full" onClick={() => handleAddToPlaylist(song)}>
									Add to playlist
								</Button>
							</CardActions>
						</CardContent>
						{song.previewUrl && (
							<ReactAudioPlayer
								ref={(element) => (audioRefs.current[song.id] = element)}
								src={song.previewUrl}
								style={{ display: "none" }}
							/>
						)}
					</Card>
				))}
			</Box>
			{similarSongs.length > 0 && (
				<div>
					<h2 className="text-xl font-bold mt-4 mb-4 text-center">Similar Songs</h2>
					<Box display="flex" flexWrap="wrap" justifyContent="center" overflow="visible" gap="10px">
						{similarSongs.map((song) => (
							<Card size="lg" variant="soft" key={song.id} sx={{ width: 320 }}>
								<AspectRatio minHeight="120px" maxHeight="200px" position="relative">
									<img src={song.image} alt={song.name} />
									{song.previewUrl ? (
										<button
											className="absolute bottom-[10px] right-[10px] bg-white rounded-full w-10 h-10 text-black outline outline-1 outline-black"
											onClick={() => handlePlayPause(song.id)}
										>
											{playingTrackId === song.id ? <Pause /> : <PlayArrow />}
										</button>
									) : (
										<h3 className="text-lg absolute bottom-[10px] right-[10px] bg-white font-bold py-1 px-2 rounded-md">
											No Preview
										</h3>
									)}
								</AspectRatio>
								<CardContent>
									<div>
										<Typography level="h4">
											<a
												href={song.spotifyUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="no-underline hover:underline hover:cursor-pointer"
											>
												{song.name}
											</a>
										</Typography>
										<Typography level="body-md">{song.artist}</Typography>
									</div>
									<CardActions>
										<Button variant="solid" color="primary" onClick={() => handleAddToPlaylist(song)}>
											Add to playlist
										</Button>
									</CardActions>
								</CardContent>
								{song.previewUrl && (
									<ReactAudioPlayer
										ref={(element) => (audioRefs.current[song.id] = element)}
										src={song.previewUrl}
										style={{ display: "none" }}
									/>
								)}
							</Card>
						))}
					</Box>
				</div>
			)}
			<Modal
				open={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				sx={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<Box className="p-4 bg-white rounded-md w-80 max-h-96 flex flex-col">
					<Typography level="h4" className="mb-4">
						Select a Playlist
					</Typography>
					<Input
						placeholder="Search for a playlist"
						size="lg"
						variant="outlined"
						value={playlistQuery}
						onChange={(e) => {
							setPlaylistQuery(e.target.value);
							handlePlaylistSearch(e.target.value);
						}}
						className="mb-4"
					/>
					<List sx={{ flexGrow: 1, overflowY: "auto" }}>
						{playlists.map((playlist) => (
							<ListItem key={playlist.id}>
								<ListItemButton onClick={() => handleSelectPlaylist(playlist.id)}>
									<ListItemContent>
										<Typography level="title-md">{playlist.name}</Typography>
									</ListItemContent>
								</ListItemButton>
							</ListItem>
						))}
					</List>
				</Box>
			</Modal>
		</div>
	);
}

export default App;
