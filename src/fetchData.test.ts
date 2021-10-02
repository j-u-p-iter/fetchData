import nock from "nock";
import fetch, { Request } from "node-fetch";
import { fetchData } from ".";

describe("fetchData", () => {
  describe("shortcut methods", () => {
    let requestOptions;

    beforeAll(() => {
      globalThis.fetch = fetch as any;
      globalThis.Request = Request as any;

      requestOptions = {
        headers: {
          Authentication: "secret"
        }
      };
    });

    describe("GET request", () => {
      /**
       * Check that the get wrapper around native fetch method::
       *   - sends correct options (by checking sending headers);
       *   - sends request to correct url
       *   - resolves with correct result
       */
      it("is sent properly", async () => {
        nock("http://some-url.com", { reqheaders: requestOptions.headers })
          .get("/products")
          .reply(200, { results: [{ id: 1 }, { id: 2 }] });

        const result = await fetchData.get(
          "http://some-url.com/products",
          requestOptions
        ).request;

        expect(result.status).toBe(200);
        expect(result.data).toEqual({
          results: [{ id: 1 }, { id: 2 }]
        });
      });
    });

    /**
     * We don't test "with body", "without body" cases here as we do for the POST
     *   request, cause PUT is always sent with the "body".
     *
     */
    describe("PUT request", () => {
      it("is sent properly", async () => {
        nock("http://some-url.com", {
          reqheaders: { "content-type": "application/json;charset=utf-8" }
        })
          .put("/products", { title: "new title" })
          .reply(200, { results: [{ id: 1 }, { id: 2 }] });

        const result = await fetchData.put("http://some-url.com/products", {
          body: { title: "new title" }
        }).request;

        expect(result.status).toBe(200);
        expect(result.data).toEqual({
          results: [{ id: 1 }, { id: 2 }]
        });
      });
    });

    /**
     * We don't test "with body", "without body" cases here as we do for the POST
     *   request, cause PATCH is always sent with the "body".
     *
     */
    describe("PATCH request", () => {
      it("is sent properly", async () => {
        nock("http://some-url.com", {
          reqheaders: { "content-type": "application/json;charset=utf-8" }
        })
          .patch("/products", { title: "new title" })
          .reply(200, { results: [{ id: 1 }, { id: 2 }] });

        const result = await fetchData.patch("http://some-url.com/products", {
          body: { title: "new title" }
        }).request;

        expect(result.status).toBe(200);
        expect(result.data).toEqual({
          results: [{ id: 1 }, { id: 2 }]
        });
      });
    });

    describe("POST request", () => {
      let dataToSend;

      beforeAll(() => {
        dataToSend = {
          title: "some title",
          description: "some description"
        };
      });

      it("sends post request properly", async () => {
        nock("http://some-url.com", { reqheaders: requestOptions.headers })
          .post("/products", dataToSend)
          .reply(201, { results: [{ id: 1 }, { id: 2 }] });

        const result = await fetchData.post("http://some-url.com/products", {
          ...requestOptions,
          body: dataToSend
        }).request;

        expect(result.status).toBe(201);
        expect(result.data).toEqual({
          results: [{ id: 1 }, { id: 2 }]
        });
      });

      describe("with body", () => {
        it("sends content-type header as application/json", async () => {
          nock("http://some-url.com", {
            reqheaders: { "content-type": "application/json;charset=utf-8" }
          })
            .post("/products", dataToSend)
            .reply(200, {});

          await fetchData.post("http://some-url.com/products", {
            body: dataToSend
          }).request;
        });
      });

      describe("without body", () => {
        it("does not send content-type header without sending body", async () => {
          nock("http://some-url.com", { badheaders: ["content-type"] })
            .post("/products")
            .reply(200, {});

          await fetchData.post("http://some-url.com/products");
        });
      });
    });
  });

  /**
   * TODO: find the way to test blob, formData and arrayBuffer
   *   resolving methods.
   *
   */
  describe("type option", () => {
    describe("by default", () => {
      it("resolves body as json", async () => {
        nock("http://some-url.com")
          .post("/products")
          .reply(200, { key: "value", oneMoreKey: "oneMoreValue" });

        const response = await fetchData.post("http://some-url.com/products")
          .request;

        expect(response.data).toEqual({
          key: "value",
          oneMoreKey: "oneMoreValue"
        });
      });
    });

    describe('with "text" value', () => {
      it("resolves body as text", async () => {
        nock("http://some-url.com")
          .post("/products")
          .reply(200, "Hello!");

        const response = await fetchData.post("http://some-url.com/products", {
          type: "text"
        }).request;

        expect(response.data).toBe("Hello!");
      });
    });

    /**
     * Using duck typing to check that instance
     *   belongs to Blob class.
     *
     */
    describe('with "blob" value', () => {
      it("resolves body as blob", async () => {
        nock("http://some-url.com")
          .post("/products")
          .reply(200, {});

        const response = await fetchData.post("http://some-url.com/products", {
          type: "blob"
        }).request;

        expect(response.data.constructor.name).toBe("Blob");
        expect(typeof response.data.text).toBe("function");
        expect(typeof response.data.arrayBuffer).toBe("function");
        expect(typeof response.data.stream).toBe("function");
      });
    });

    /**
     * Using duck typing to check that instance
     *   belongs to ArrayBuffer class.
     *
     */
    describe('with "arrayBuffer" value', () => {
      it("resolves body as text", async () => {
        nock("http://some-url.com")
          .post("/products")
          .reply(200, {});

        const response = await fetchData.post("http://some-url.com/products", {
          type: "arrayBuffer"
        }).request;

        expect(response.data.constructor.name).toEqual("ArrayBuffer");
        expect(typeof response.data.byteLength).toBe("number");
        expect(typeof response.data.slice).toBe("function");
      });
    });
  });

  describe("HTTP error", () => {
    it("is thrown in case non successful response (non-2xx status)", async () => {
      nock("http://some-url.com")
        .get("/products")
        .reply(400);

      expect(
        fetchData.get("http://some-url.com/products").request
      ).rejects.toThrow("Request is not resolved successfully");
    });
  });

  describe("cancelRequest method from response", () => {
    it("cancels request and throws AbortError", () => {
      nock("http://some-url.com")
        .get("/products")
        .reply(200, { key: "value" });

      const { cancelRequest, request } = fetchData.get(
        "http://some-url.com/products"
      );

      cancelRequest();

      expect(request).rejects.toThrow("AbortError");
    });
  });
});
