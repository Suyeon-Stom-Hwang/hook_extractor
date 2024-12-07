import * as React from "react";
import ReactPaginate from "react-paginate";
import { useRecoilValue } from "recoil";
import { useEffect, useRef } from "react";
import { alcoholListState } from "../Store/selector";
import Items from "./Items";
import "../Styles/Home.scss";
import "../Styles/Pagination.css";
import "../Styles/Reset.css";

function PaginatedItems(props) {
  const alcoholList = useRecoilValue(alcoholListState);
  const scrollToRef = useRef();

  const itemsPerPage = props.itemsPerPage;
  const pageCount = props.pageCount;
  const setPageCount = props.setPageCount;
  const currentAlcoholList = props.currentAlcoholList;
  const setCurrentAlcoholList = props.setCurrentAlcoholList;
  const itemOffset = props.itemOffset;
  const setItemOffset = props.setItemOffset;

  useEffect(() => {
    const endOffset = itemOffset + itemsPerPage;
    setCurrentAlcoholList(alcoholList.slice(itemOffset, endOffset));
    setPageCount(Math.ceil(alcoholList.length / itemsPerPage));
  }, [itemOffset, itemsPerPage]);
  const handlePageClick = (event) => {
    const newOffset = (event.selected * itemsPerPage) % alcoholList.length;
    setItemOffset(newOffset);
  };

  return (
    <>
      <div ref={scrollToRef} className="liquor-card-wrapper">
        <Items currentItems={currentAlcoholList} />
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

export default PaginatedItems;
