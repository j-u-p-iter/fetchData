import nock from "nock";
import fetch, { Request } from "node-fetch";
import { createFetchData, fetchData } from ".";

describe("fetchData", () => {
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

  describe("searchParams option", () => {
    describe("when searchParams is a string", () => {
      it("adds query string properly", async () => {
        nock("http://some-url.com")
          .get("/products")
          .query({ q: "hello" })
          .reply(200, {});

        const result = await fetchData.get("http://some-url.com/products", {
          searchParams: "q=hello"
        }).request;

        expect(result.status).toBe(200);
      });
    });

    describe("when searchParams is an object", () => {
      it("adds query string properly", async () => {
        nock("http://some-url.com")
          .get("/products")
          .query({ q: "hello", m: "value" })
          .reply(200, {});

        const result = await fetchData.get("http://some-url.com/products", {
          searchParams: { q: "hello", m: "value" }
        }).request;

        expect(result.status).toBe(200);
      });
    });

    describe("when query string is included in the url", () => {
      it("rewrites the original query string", async () => {
        nock("http://some-url.com")
          .get("/products")
          .query({ q: "hello", m: "value" })
          .reply(200, {});

        const result = await fetchData.get(
          "http://some-url.com/products?v=someValue&z=anotherValue",
          { searchParams: { q: "hello", m: "value" } }
        ).request;

        expect(result.status).toBe(200);
      });
    });
  });

  describe("shortcut methods", () => {
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
    it("cancels request and throws AbortError", async () => {
      nock("http://some-url.com")
        .get("/products")
        .reply(200, { key: "value" });

      const { cancelRequest, request } = fetchData.get(
        "http://some-url.com/products"
      );

      cancelRequest();

      await expect(request).rejects.toThrow("The user aborted a request.");
    });
  });

  describe("urlPrefix", () => {
    describe("without prefix", () => {
      it("sends request to the original url from arguments", async () => {
        nock("http://some-url.com")
          .get("/products")
          .reply(200, { key: "value" });

        await fetchData.get("http://some-url.com/products").request;
      });
    });

    describe("with url, that starts with /, and url prefix that ends with /", () => {
      it("sends request to the prefixed url", async () => {
        nock("http://some-url.com")
          .get("/products")
          .reply(200, { key: "value" });

        await fetchData.get("/products", { urlPrefix: "http://some-url.com/" })
          .request;
      });
    });

    describe("with url, that does not start with /, and url prefix that does not end with /", () => {
      it("sends request to the prefixed url", async () => {
        nock("http://some-url.com")
          .get("/products")
          .reply(200, { key: "value" });

        await fetchData.get("products", { urlPrefix: "http://some-url.com" })
          .request;
      });
    });
  });

  describe("createFetchData", () => {
    it("allows to set up default options for fetchData", async () => {
      nock("http://site.com")
        .get("/products")
        .reply(200, { key: "value" });

      nock("http://new-site.com")
        .get("/users")
        .reply(200, { newKey: "newValue" });

      const productsFetchData = createFetchData({
        urlPrefix: "http://site.com"
      });
      const { data: products } = await productsFetchData.get("products")
        .request;

      const usersFetchData = createFetchData({
        urlPrefix: "http://new-site.com"
      });
      const { data: users } = await usersFetchData.get("users").request;

      expect(products).toEqual({ key: "value" });
      expect(users).toEqual({ newKey: "newValue" });
    });
  });

  describe("hooks", () => {
    describe("beforeRequest hook", () => {
      it("updates request properly", async () => {
        nock("http://site.com", {
          reqheaders: { Authorization: "Bearer 12345" }
        })
          .get("/products")
          .reply(200, { key: "value" });

        const beforeRequestHook = request => {
          request.headers.set("Authorization", "Bearer 12345");
        };

        const { data } = await fetchData.get("http://site.com/products", {
          hooks: {
            beforeRequest: [beforeRequestHook]
          }
        }).request;

        expect(data).toEqual({ key: "value" });
      });
    });

    describe("afterResponse hook", () => {
      it("updates request properly", async () => {
        expect.hasAssertions();

        const onErrorResponse = jest.fn();

        nock("http://site.com")
          .get("/products")
          .reply(401);

        const afterResponseHook = response => {
          if (response.status === 401) {
            onErrorResponse();
          }
        };

        try {
          await fetchData.get("http://site.com/products", {
            hooks: {
              afterResponse: [afterResponseHook]
            }
          }).request;
        } catch (error) {
          expect(onErrorResponse).toHaveBeenCalledTimes(1);
        }
      });
    });
  });
});
