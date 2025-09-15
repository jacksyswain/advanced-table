import axios from 'axios';

export const fetchArtworks = async (page: number) => {
  // API described in the assignment
  const url = `https://api.artic.edu/api/v1/artworks?page=${page}`;
  const res = await axios.get(url);
  return res.data;
};
