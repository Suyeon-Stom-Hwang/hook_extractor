import * as React from "react";
import ReactPaginate from "react-paginate";
import { useEffect, useRef } from "react";
import FilteredItems from "./FilteredItems";
import "../Styles/Home.scss";
import "../Styles/Pagination.css";
import "../Styles/Reset.css";

function FilteredPaginatedItems({
  itemsPerPage,
  pageCount,
  setPageCount,
  alcoholList,
}) {
  const [currentFilteredAlcoholList, setCurrentFilteredAlcoholList] =
    React.useState([]);
  const [filteredItemOffset, setFilteredItemOffset] = React.useState(0);
  const scrollToRef = useRef();
  useEffect(() => {
    const filteredEndOffset = filteredItemOffset + itemsPerPage;
    setCurrentFilteredAlcoholList(
      alcoholList.slice(filteredItemOffset, filteredEndOffset)
    );
    setPageCount(Math.ceil(alcoholList.length / itemsPerPage));
  }, [alcoholList, filteredItemOffset, itemsPerPage]);
  const handlePageClick = (event) => {
    const newOffset = (event.selected * itemsPerPage) % alcoholList.length;
    setFilteredItemOffset(newOffset);
  };
  return (
    <>
      <div ref={scrollToRef} className="liquor-card-wrapper">
        <FilteredItems
          currentFilteredAlcoholList={currentFilteredAlcoholList}
        />
      </div>
      <div className="footer">
        <ReactPaginate
          breakLabel="..."
          nextLabel=">"
          onPageChange={handlePageClick}
          pageRangeDisplayed={5}
          pageCount={pageCount}
          previousLabel="<"
          renderOnZeroPageCount={null}
          containerClassName={"pagination-ul"}
          activeClassName={"currentPage"}
          previousClassName={"pageLabel-btn"}
          nextClassName={"pageLabel-btn"}
          onClick={() =>
            scrollToRef.current.scrollIntoView({ behavior: "smooth" })
          }
        />
      </div>
    </>
  );
}

export default FilteredPaginatedItems;
