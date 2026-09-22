// Official award/grant/scholarship pages per IEEE society. These sites vary widely
// in structure (some are JS-heavy or block scrapers), so the scraper treats each
// entry as best-effort: if no listings can be parsed, the frontend falls back to
// linking users directly to `url`.
module.exports = [
  {
    society: "GENERAL",
    label: "General (All IEEE Members)",
    url: "https://www.ieeefoundation.org/students-and-young-professionals/",
  },
  {
    society: "WIE",
    label: "Women in Engineering",
    url: "https://wie.ieee.org/grants-scholarships/",
  },
  {
    society: "AES",
    label: "Aerospace and Electronic Systems Society",
    url: "https://ieee-aess.org/awards",
  },
  {
    society: "APS",
    label: "Antennas and Propagation Society",
    url: "https://ieeeaps.org/awards/complete-list-of-ap-s-awards",
  },
  {
    society: "CS",
    label: "Computer Society",
    url: "https://www.computer.org/volunteering/awards/scholarships",
  },
  {
    society: "CIS",
    label: "Computational Intelligence Society",
    url: "https://cis.ieee.org/awards",
  },
  {
    society: "GRSS",
    label: "Geoscience and Remote Sensing Society",
    url: "https://www.grss-ieee.org/community/awards/",
  },
  {
    society: "SIGHT",
    label: "Special Interest Group on Humanitarian Technology",
    url: "https://sight.ieee.org/",
  },
  {
    society: "MTTS",
    label: "Microwave Theory and Techniques Society",
    url: "https://mtt.org/awards-overview/",
  },
  {
    society: "PELS",
    label: "Power Electronics Society",
    url: "https://www.ieee-pels.org/awards/",
  },
  {
    society: "PES",
    label: "Power & Energy Society",
    url: "https://ieee-pes.org/about-pes/awards-scholarships/",
  },
  {
    society: "RAS",
    label: "Robotics and Automation Society",
    url: "https://www.ieee-ras.org/awards-recognition",
  },
  {
    society: "VTS",
    label: "Vehicular Technology Society",
    url: "https://vtsociety.org/awards/about-awards",
  },
];
