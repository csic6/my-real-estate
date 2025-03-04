import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import SearchBar from "@/components/SearchBar";
import Filters from "@/components/Filters";
import Auth from "@/components/Auth";
import Payment from "@/components/Payment";
import Invoice from "@/components/Invoice";
import UserDashboard from "@/components/UserDashboard";
import PaymentHistory from "@/components/PaymentHistory";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

export default function Home() {
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({ priceMin: 0, priceMax: 1000000 });
  const [user, setUser] = useState(null);
  const [invoiceData, setInvoiceData] = useState(null);
  const [invoiceType, setInvoiceType] = useState("private"); // "private" or "business"
  const [businessDetails, setBusinessDetails] = useState({ name: "", registryCode: "", address: "" });

  useEffect(() => {
    axios.get("/api/listings").then((response) => {
      setListings(response.data);
      setFilteredListings(response.data);
    });
  }, []);

  useEffect(() => {
    const filtered = listings.filter(listing => 
      listing.isActive &&
      listing.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      listing.price >= filters.priceMin && listing.price <= filters.priceMax
    );
    setFilteredListings(filtered);
  }, [searchQuery, filters, listings]);

  const handlePaymentSuccess = async (paymentInfo) => {
    setInvoiceData({ ...paymentInfo, invoiceType, businessDetails });
    await axios.post("/api/activate-listing", { userId: user.id, listingId: paymentInfo.listingId });
    const { data: invoice } = await axios.post("/api/generate-invoice", { userId: user.id, paymentInfo });
    await axios.post("/api/send-payment-confirmation-email", { userId: user.id, paymentInfo, invoice });
    axios.get("/api/listings").then(response => setListings(response.data));
  };

  useEffect(() => {
    const checkExpiredListings = () => {
      axios.get("/api/check-expired-listings").then(response => {
        response.data.expiredListings.forEach(listing => {
          axios.post("/api/send-expiration-email", { userId: listing.userId, listingId: listing.id });
        });
      });
    };
    
    const interval = setInterval(checkExpiredListings, 86400000); // Kontrollib kord päevas
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Kinnisvara Maardis</h1>
      <Auth user={user} setUser={setUser} />
      <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      <Filters filters={filters} setFilters={setFilters} />
      {user && (
        <>
          <UserDashboard user={user} onPaymentSuccess={handlePaymentSuccess} />
          <PaymentHistory userId={user.id} allowInvoiceDownload={true} />
          <div className="mb-4">
            <label className="mr-2">Arve tüüp:</label>
            <select onChange={(e) => setInvoiceType(e.target.value)} value={invoiceType}>
              <option value="private">Eraisik</option>
              <option value="business">Ettevõte</option>
            </select>
          </div>
          {invoiceType === "business" && (
            <div className="mb-4">
              <input type="text" placeholder="Ettevõtte nimi" onChange={(e) => setBusinessDetails({...businessDetails, name: e.target.value})} className="border p-2 mr-2" />
              <input type="text" placeholder="Registrikood" onChange={(e) => setBusinessDetails({...businessDetails, registryCode: e.target.value})} className="border p-2 mr-2" />
              <input type="text" placeholder="Aadress" onChange={(e) => setBusinessDetails({...businessDetails, address: e.target.value})} className="border p-2" />
            </div>
          )}
          <Payment user={user} paymentGateway="maksekeskus" paymentMethods={["bank", "creditcard"]} onSuccess={handlePaymentSuccess} />
        </>
      )}
      {invoiceData && <Invoice invoiceData={invoiceData} allowDownload={true} />}
      <Map listings={filteredListings} />
    </div>
  );
}
