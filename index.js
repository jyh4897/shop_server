const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const mysqlPromise = require("mysql2/promise");
const bcrypt = require("bcrypt");
// const bodyParser = require("body-parser"); // express 모듈이 대체 가능함_이기현
const session = require("express-session"); //0213 김민호 세션 추가
const MySQLStore = require("express-mysql-session")(session); //0213 김민호
const dotenv = require("dotenv"); // 추가_이기현

const multer = require("multer");
const path = require("path");

dotenv.config(); // 추가_이기현

const Server_URL = process.env.REACT_APP_Server_Side_Address;

// 이기현_추가 코드 ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ

// chatGPT 설명
// mysql2/promise:
// 프로미스 기반의 API를 사용합니다.
// 쿼리를 수행한 결과가 프로미스로 반환되어 .then() 및 .catch()를 사용하여 처리할 수 있습니다.

// 저는 "mysql2/promise" 모듈을 사용하였기에 코드를 취합하는 과정에서 문제가 발생합니다.
// 그러므로 다른 변수 이름(mysqlPromise)으로 해당 모듈을 사용해서,
// MySQL 연결을 추가 설정함으로써 문제를 해결하였습니다.

// 밑에 MySQL 연결 설정 문단에서 주석을 확인해주십시오.

// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ

const app = express();
// const port = 8000; // 폐기_이기현
app.set("port", process.env.PORT || 8000); // 추가_이기현

app.use(express.urlencoded({ extended: false })); // bodyParser >> express 대체_이기현
app.use(express.json()); // bodyParser >> express 대체_이기현

// CORS 설정
app.use(cors({ origin: "http://localhost:3000" }));

app.use(express.static(path.join(__dirname + "/images")));

// 이기현_추가 주석 ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ

// 현재 MySQL 연결 설정이 각각 connection, PromiseConnection 이름으로 되어있습니다,
// chatGPT 의 답변에 따르면, 현재의 코드는 문제가 없다고 하며,
// 실제로 목 데이터를 넣고 사용한 결과, 별다른 문제점은 발견되지 않았습니다.
// const mysql = require("mysql2") 기반으로 모듈을 사용한 분은 connection 사용하시고,
// 저처럼 require("mysql2/promise") 기반으로 모듈을 사용한 분은 PromiseConnection 을
// 사용하시기 바랍니다.

// 문제가 발생할 경우 제게도 알려주세요!

// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ

const { DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE, DB_PORT } = process.env;
const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;
const { NH_AccessToken, NH_Iscd } = process.env;

// MySQL 연결 설정
const connection = mysql.createConnection({
  // 외부 데이터 베이스 MySQL
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_DATABASE,
  port: DB_PORT,
});

// 프로미스 기반 MySQL 연결 설정
const PromiseConnection = mysqlPromise.createPool({
  // 외부 데이터 베이스 MySQL
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_DATABASE,
  port: DB_PORT,
});

// MySQL 연결
connection.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL: " + err.stack);
    return;
  }
  console.log("Connected to MySQL as id " + connection.threadId);
});

app.get("/", (req, res) => res.send(`Hell'o World!`));

// orders 테이블이 존재하지 않을 경우 생성 쿼리문
// FOREIGN KEY 추가
const createOrdersTableQuery = `CREATE TABLE IF NOT EXISTS orders (

  id INT AUTO_INCREMENT PRIMARY KEY,
  orderNumber VARCHAR(40) NOT NULL,
  userId INT,
  FOREIGN KEY (userId) REFERENCES user(userid),
  productCode VARCHAR(40) NOT NULL,
  status VARCHAR(20) DEFAULT "주문완료",
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  orderName VARCHAR(100) NOT NULL,
  zipcode VARCHAR(10),
  addr VARCHAR(255) NOT NULL,
  addrDetail VARCHAR(255),
  phoneNumber VARCHAR(20) NOT NULL,
  reqMessage VARCHAR(255),
  count INT NOT NULL,
  totalCount INT NOT NULL,
  totalAmount INT NOT NULL,
  payment VARCHAR(20) NOT NULL,
  refundText VARCHAR(255),
  usePoint INT DEFAULT 0,
  imageURL VARCHAR(600),
  paymentAmount INT DEFAULT 0,
  reviewStatus TINYINT(1) DEFAULT 0
);`;

connection.query(createOrdersTableQuery); // orders 테이블 생성

// NH 환율 조회 API
// 참조 사이트 : 농협 NH 개발자 센터
// https://developers.nonghyup.com/

const NH_url = "https://developers.nonghyup.com/InquireExchangeRate.nh";

// 날짜를 구하는 메소드
const getValidTodayString = () => {
  // 반환할 객체(문자열 데이터)
  const todayStringData = {
    tsymd: "", // YYYYMMDD
    trtm: "", // HHMMSS
  };

  const now = new Date(); // 날짜 객체

  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  // 객체(todayStringData)에 데이터 저장
  todayStringData["tsymd"] = `${year}${month}${day}`;
  todayStringData["trtm"] = `${hours}${minutes}${seconds}`;

  return todayStringData;
};

// 기관거래고유번호(IsTuno) 6자리 문자열 데이터 랜덤 추출
const getRandomIsTuno = () => {
  const allPossibilities = 999999; // 6자리의 모든 경우의 수
  const getCode = String(
    Math.floor(Math.random() * allPossibilities) + 1
  ).padStart(6, "0");

  return getCode;
};

// NH 환욜 조회 요청
// POST
const fetchExchangeRate = async () => {
  try {
    // YYYYMMDD, HHMMSS 형식의 날짜 데이터 추출
    const { tsymd, trtm } = getValidTodayString();

    let data; // 반환할 최종 데이터셋
    let whileCondition = true; // while 반복문 조건

    while (whileCondition) {
      // 요청 정보가 담긴 객체
      const requestData = {
        Header: {
          ApiNm: "InquireExchangeRate",
          Tsymd: tsymd, // YYYYMMDD 문자열 데이터
          Trtm: trtm, // HHMMSS 문자열 데이터
          Iscd: NH_Iscd, // 고유 기관코드
          FintechApsno: "001",
          ApiSvcCd: "DrawingTransferA",
          IsTuno: getRandomIsTuno(), // 이미 사용된 기관거래고유번호는 작동 안됨_테스트 한정
          AccessToken: NH_AccessToken, // API 접근 AccessToken
        },
        Btb: "0001", // 과거 환율
        Crcd: "USD", // 미국 달러
        Inymd: "20191213", // 환율을 조회할 날짜. 테스트버전은 "20191213" 고정값
      };

      // 환율 정보 데이터 요청(POST)
      const response = await fetch(NH_url, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      // 응답 받은 데이터 저장
      data = await response.json();

      // data.REC 값이 참이면 정상적으로 처리가 되었음을 의미한다. while문 종료.
      if (data.REC) whileCondition = false;
    }

    return data.REC[0].BrgnBsrt; // 환율 매매기준율 전달 및 반환
  } catch (error) {
    console.error("환율 조회 요청에 실패하였습니다.", error);
  }
};

// "/getExchangeRate" 환율 조회 요청
app.get("/getExchangeRate", async (req, res) => {
  try {
    const data = await fetchExchangeRate();
    res.json(data);
  } catch (error) {
    console.error("환율 조회 API에 문제가 발생하였습니다.", error);
    res.send(false);
  }
});

// ㅡㅡㅡㅡㅡ 환율 조회 API 종료

// 여기서부터 Paypal API  코드  ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ
// 현재는 장바구니 데이터에 접근할 수 없으므로 모두 주석처리

const base = "https://api-m.sandbox.paypal.com";

// // paypal API 인증 토큰 발급
const generateAccessToken = async () => {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("MISSING_API_CREDENTIALS");
    }

    // 인증키 암호화
    const auth = Buffer.from(
      PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET
    ).toString("base64");

    // paypal 서버에 데이터 전송 및 응답
    const response = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      body: "grant_type=client_credentials",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Failed to generate Access Token:", error);
  }
};

/**
 * Create an order to start the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_create
 */
const createOrder = async (cart, usePoint) => {
  // use the cart information passed from the front-end to calculate the purchase unit details
  console.log(
    "shopping cart information passed from the frontend createOrder() callback:",
    cart
  );

  let sumAmount = 0;
  const accessToken = await generateAccessToken(); // accessToken 발급받기
  const url = `${base}/v2/checkout/orders`;
  cart.map((item) => (sumAmount += item.price * item.quantity));
  sumAmount = sumAmount - usePoint;

  sumAmount = Math.ceil(sumAmount / 1332.7);

  // paypal 사용자 정보
  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "USD",
          value: sumAmount,
        },
      },
    ],
  };

  // paypal 서버에 구매 명세서를 동봉하여 데이터 전송 및 응답
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    method: "POST",
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

/**
 * Capture payment for the created order to complete the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_capture
 */
const captureOrder = async (orderID) => {
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders/${orderID}/capture`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return handleResponse(response);
};

// 응답받은 데이터를 json() 변환
async function handleResponse(response) {
  try {
    const jsonResponse = await response.json();
    return {
      jsonResponse,
      httpStatusCode: response.status,
    };
  } catch (err) {
    const errorMessage = await response.text();
    throw new Error(errorMessage);
  }
}

app.post("/orders", async (req, res) => {
  try {
    // use the cart information passed from the front-end to calculate the order amount detals
    const { cart, usePoint } = req.body;
    const { jsonResponse, httpStatusCode } = await createOrder(cart, usePoint);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order." });
  }
});

app.post("/orders/:orderID/capture", async (req, res) => {
  try {
    const { orderID } = req.params;
    const { jsonResponse, httpStatusCode } = await captureOrder(orderID);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to capture order." });
  }
});

// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ

// DB order 테이블에 사용자의 주문서 등록
app.post("/reqOrder", async (req, res, next) => {
  try {
    const { orderSheet } = req.body;
    const orderUserId = orderSheet[0].userId; // 주문자 코드 저장

    let usePoint = Number(orderSheet[0].usePoint); // 주문자가 사용한 포인트를 저장

    // order 테이블 추가 쿼리
    const insertQuery =
      "INSERT INTO orders (orderNumber, userId, productCode, orderName, addr, phoneNumber, reqMessage, count, totalCount, totalAmount, payment, usePoint, imageURL, paymentAmount) VALUES (?)";

    // 사용자의 고유 코드(userid)를 참조하여, 해당 사용자의 포인트 데이터를 조회하는 쿼리
    const selectQuery = "SELECT point FROM user WHERE userid = ?";
    // 사용자의 point 데이터를 업데이트 하는 쿼리
    const updateQuery = "UPDATE user SET point = ? WHERE userid = ?";

    orderSheet.map(async (article) => {
      const data = [
        article.orderNumber,
        article.userId,
        article.id,
        article.name,
        article.addr,
        article.phoneNumber,
        article.reqMessage,
        article.quantity,
        article.totalCount,
        article.totalAmount,
        article.payment,
        article.usePoint,
        article.imageURL,
        article.paymentAmount,
      ];

      await PromiseConnection.query(insertQuery, [data]);
    });

    // 사용자 포인트 조회 쿼리
    const [getUserPointData] = await PromiseConnection.query(selectQuery, [
      orderUserId,
    ]);

    // 사용자의 보유 포인트 - 사용 포인트 값을 저장
    usePoint = Number(getUserPointData[0].point) - usePoint;

    // 사용자의 포인트 업데이트 쿼리
    await PromiseConnection.query(updateQuery, [usePoint, orderUserId]);

    return res.redirect("/");
  } catch (error) {
    console.error(error);
    next(error);
  }
});

// 오더시트에서 사용자 정보 조회
app.get("/ordersheet", async (req, res, next) => {
  try {
    const { userId } = req.query;
    const [userData] = await PromiseConnection.query(
      "SELECT username, phonenumber, address, detailedaddress, userid, point FROM user WHERE userid = ?",
      [userId]
    );
    return res.send(userData);
  } catch (error) {
    console.error(error);
    next(error);
  }
});

// 사용자 주문 내역 페이지에서의 특정 기간별 주문 데이터 요청
// GET
app.get("/getOrderList", async (req, res, next) => {
  try {
    const { userId, periodDate } = req.query;

    const startDate = periodDate[0]; // 시작 기간 변수 선언
    const endDate = periodDate[1]; // 끝 기간 변수 선언

    const orderQuery =
      "SELECT * FROM orders WHERE userId = ? AND date BETWEEN ? AND ? ORDER BY date DESC";
    const productQuery = "SELECT prodid, title FROM shopproducts";

    const [orderData] = await PromiseConnection.query(orderQuery, [
      userId,
      startDate,
      endDate,
    ]);
    const [productData] = await PromiseConnection.query(productQuery);

    return res.send({ orderData: orderData, productData: productData });
  } catch (error) {
    console.error(error);
    next(error);
  }
});

// 주문 완료 페이지에서 상품 코드를 기반으로,
// 해당 상품을 구매한 사용자들의 회원 식별 정보를 요청
// GET
app.get("/products/usertype", async (req, res, next) => {
  try {
    const query =
      "SELECT user.userid, user.usertype, orders.productCode FROM user INNER JOIN orders ON user.userid = orders.userId WHERE orders.productCode = ?";
    const { productCode } = req.query;
    const [getUserData] = await PromiseConnection.query(query, [productCode]); // productCode 를 기반으로 쿼리문 실행

    // 성별 데이터 객체
    const userTypeCountData = {
      buyerPersonal: 0,
      buyerCorporate: 0,
      buyerGroup: 0,
    };

    // 배열을 순회하며, 일치하는 성별이 있을 때마다 그 성별의 데이터를 1씩 증가
    getUserData.forEach((userData) => {
      const { usertype } = userData;

      switch (usertype) {
        case "1": {
          userTypeCountData["buyerPersonal"] =
            userTypeCountData["buyerPersonal"] + 1;
          break;
        }
        case "2": {
          userTypeCountData["buyerCorporate"] =
            userTypeCountData["buyerCorporate"] + 1;
          break;
        }
        case "3": {
          userTypeCountData["buyerGroup"] = userTypeCountData["buyerGroup"] + 1;
          break;
        }
        default: {
          console.log("정의되지 않은 사용자 유형입니다.");
          break;
        }
      }
    });

    // 백분율로 변환, 표본 수 숨기기
    userTypeCountData["buyerPersonal"] = Math.round(
      (userTypeCountData["buyerPersonal"] / getUserData.length) * 100
    );
    userTypeCountData["buyerCorporate"] = Math.round(
      (userTypeCountData["buyerCorporate"] / getUserData.length) * 100
    );
    userTypeCountData["buyerGroup"] = Math.round(
      (userTypeCountData["buyerGroup"] / getUserData.length) * 100
    );

    return res.json(userTypeCountData);
  } catch (error) {
    console.error(error);
    next(error);
  }
});

//-------------------------------로그인-----------------------------------------------

//-------------------------------익스플로스 세션 0213------------------------------------
const sessionStore = new MySQLStore(
  {
    expiration: 3600000, // 세션의 유효시간 (1시간)
    createDatabaseTable: true, // 세션 테이블을 자동으로 생성
    schema: {
      tableName: "sessions", // 세션 테이블의 이름
      columnNames: {
        session_id: "session_id", // 세션 ID를 저장하는 열의 이름
        expires: "expires", // 세션 만료 시간을 저장하는 열의 이름
        data: "data", // 세션 데이터를 저장하는 열의 이름
      },
    },
  },
  connection
);

app.use(
  session({
    secret: "secretKey", // 랜덤하고 안전한 문자열로 바꾸세요.
    resave: false,
    saveUninitialized: true,
    store: sessionStore,
    cookie: {
      maxAge: 3600000,
      httpOnly: true,
    },
  })
);
//-------------------------------로그인------------------------------------

app.post("/login", async (req, res) => {
  const { email, password, usertype } = req.body; //usertype 추가 2/14 김민호

  try {
    // 이메일을 사용하여 데이터베이스에서 사용자를 찾습니다.
    connection.query(
      "SELECT * FROM user WHERE email = ?",
      [email],
      async (err, result) => {
        if (err) {
          console.error("서버에서 에러 발생:", err);
          res.status(500).send({ success: false, message: "서버 에러 발생" });
        } else {
          if (result.length > 0) {
            const isPasswordMatch = await bcrypt.compare(
              password,
              result[0].password
            );
            if (isPasswordMatch && usertype == result[0].usertype) {
              // 0213 김민호 세션스토리 초기화 확인
              if (!req.session) {
                req.session = {};
              }
              //세션데이터 저장(새로운 데이터 추가시 이부분 수정)
              req.session.usertype = result[0].usertype; //0213 김민호 익스플로우 세션기능 추가
              req.session.userid = result[0].userid; //0213 김민호 익스플로우 세션기능 추가

              res.send({ success: true, message: "로그인 성공", data: result });
            } else {
              res.send({
                success: false,
                message: "정보가 일치하지 않습니다.",
                //가입은 되어 있으나 정보가 맞지 않을 때
              });
            }
          } else {
            res.send({ success: false, message: "유저 정보가 없습니다." });
            //가입된 정보가 없을 시 출력
          }
        }
      }
    );
  } catch (error) {
    console.error("비밀번호 비교 중 오류:", error);
    res.status(500).send({ success: false, message: "서버 에러 발생" });
  }
});
//-------------------------------회원가입----------------------------------------------
//---------------------------------- 회원번호---------------------------------------------
const usedUserNumbers = new Set(); // 중복 방지를 위한 Set

async function generateUserid(usertype) {
  // 사용자 유형에 기반한 사용자 ID를 생성하는 로직을 추가합니다.
  // 단순성을 위해 사용자 유형에 따라 접두어를 추가하고 6자리의 랜덤 숫자를 붙입니다.
  const prefix = {
    personal: 1,
    business: 2,
    organization: 3,
  }[usertype];

  do {
    randomDigits = Math.floor(10000 + Math.random() * 90000);
    userid = `${prefix}${randomDigits}`;
  } while (usedUserNumbers.has(userid)); // 중복된 userid가 있다면 다시 생성

  usedUserNumbers.add(userid); // Set에 추가

  return userid;
}
//-------------------------------사업자 중복 체크 2/14 김민호---------------------------------
// app.post("/checkbusinessnumber", (req, res) => {
//   const { businessnumber} = req.body;

//   // 데이터베이스에서 이메일이 이미 존재하는지 확인합니다.
//   const sql = "SELECT * FROM user WHERE email = ?";
//   connection.query(sql, [businessnumber], (err, result) => {
//     if (err) {
//       console.error("MySQL에서 사업자번호 중복 확인 중 오류:", err);
//       return res.status(500).json({
//         success: false,
//         message: "사업자 중복 확인 중 오류가 발생했습니다.",
//         error: err.message,
//       });
//     }

//     if (result.length > 0) {
//       // 이미 등록된 사업자인 경우
//       return res.status(200).json({
//         success: false,
//         message: "이미 등록된 사업자입니다.",
//       });
//     } else {
//       // 중복되지 않은 사업자인 경우
//       return res.status(200).json({
//         success: true,
//         message: "사용 가능한 사업자 입니다.",
//       });
//     }
//   });
// });

//-------------------------------이메일 중복 체크 2/14 김민호---------------------------------
app.post("/checkEmailDuplication", (req, res) => {
  const { email } = req.body;

  // 데이터베이스에서 이메일이 이미 존재하는지 확인합니다.
  const sql = "SELECT * FROM user WHERE email = ?";
  connection.query(sql, [email], (err, result) => {
    if (err) {
      console.error("MySQL에서 이메일 중복 확인 중 오류:", err);
      return res.status(500).json({
        success: false,
        message: "이메일 중복 확인 중 오류가 발생했습니다.",
        error: err.message,
      });
    }

    if (result.length > 0) {
      // 이미 등록된 이메일인 경우
      return res.status(200).json({
        success: false,
        message: "이미 등록된 이메일입니다.",
      });
    } else {
      // 중복되지 않은 이메일인 경우
      return res.status(200).json({
        success: true,
        message: "사용 가능한 이메일입니다.",
      });
    }
  });
});
//---------------------------회원가입 기능구현----------------------------------------------
app.post("/regester", async (req, res) => {
  // 클라이언트에서 받은 요청의 body에서 필요한 정보를 추출합니다.
  const {
    username,
    password,
    email,
    address,
    detailedaddress,
    phonenumber,
    usertype: clientUsertype,
    businessnumber,
  } = req.body;

  try {
    // 비밀번호를 해시화합니다.
    const hashedPassword = await bcrypt.hash(password, 10);

    // 회원번호를 생성합니다. (6자리)
    const userid = await generateUserid(clientUsertype);

    // 클라이언트에서 받은 usertype을 서버에서 사용하는 usertype으로 변환합니다.
    const usertypeNumber = {
      personal: 1, // 개인
      business: 2, // 기업
      organization: 3, // 단체
    };

    const serverUsertype = usertypeNumber[clientUsertype];

    // MySQL 쿼리를 작성하여 회원 정보를 데이터베이스에 삽입합니다.
    const sql =
      "INSERT INTO user (userid, username, email, password, address, detailedaddress, phonenumber, usertype, businessnumber) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    connection.query(
      sql,
      [
        userid,
        username,
        email,
        hashedPassword,
        address,
        detailedaddress,
        phonenumber,
        serverUsertype,
        businessnumber,
      ],
      (err, result) => {
        if (err) {
          // 쿼리 실행 중 에러가 발생한 경우 에러를 처리합니다.
          console.error("MySQL에 데이터 삽입 중 오류:", err);
          return res.status(500).json({
            success: false,
            message: "회원가입 중 오류가 발생했습니다.",
            error: err.message,
          });
        }
        // 회원가입이 성공한 경우 응답을 클라이언트에게 보냅니다.
        console.log("사용자가 성공적으로 등록됨");
        return res.status(200).json({
          success: true,
          message: "사용자가 성공적으로 등록됨",
          usertype: serverUsertype,
        });
      }
    );
  } catch (error) {
    // 회원가입 중 다른 내부적인 오류가 발생한 경우 에러를 처리합니다.
    console.error("회원가입 중 오류:", error);
    return res.status(500).json({
      success: false,
      message: "내부 서버 오류",
      details: error.message,
    });
  }
});
//---------------------------회원가입 수정구현----------------------------------------------
// app.get("/user", (req, res) => {
//   const { usertype, userid } = req.session;

//   if (!usertype || !userid) {
//     return res.status(401).json({ success: false, message: "로그인되어 있지 않습니다." });
//   }

//   // 여기에서 데이터베이스에서 사용자 정보를 가져오는 로직을 구현합니다.
//   const sql = "SELECT * FROM user WHERE userid = ?";
//   connection.query(sql, [userid], (err, result) => {
//     if (err) {
//       console.error("사용자 정보 조회 중 오류:", err);
//       return res.status(500).json({ success: false, message: "사용자 정보 조회 중 오류가 발생했습니다." });
//     }

//     const userData = result[0]; // 첫 번째 사용자 정보를 가져옴

//     if (!userData) {
//       return res.status(404).json({ success: false, message: "사용자 정보를 찾을 수 없습니다." });
//     }

//     res.status(200).json(userData);
//   });
// });

// 전윤호 -------------------------------

app.get("/shop", (req, res) => {
  const sqlQuery = "SELECT * FROM ezteam2.SHOPPRODUCTS;";
  connection.query(sqlQuery, (err, result) => {
    res.send(result);
  });
});

app.get("/review", (req, res) => {
  const sqlQuery = "SELECT * FROM ezteam2.productreview;";
  connection.query(sqlQuery, (err, result) => {
    res.send(result);
  });
});

app.get("/question", (req, res) => {
  const sqlQuery = "SELECT * FROM ezteam2.productquestion;";
  connection.query(sqlQuery, (err, result) => {
    res.send(result);
  });
});

app.post("/question", (req, res) => {
  const values = req.body;
  const sqlQuery =
    "INSERT INTO ezteam2.productquestion (qid, prodid, userid,content, date) VALUES (null, ?, ?, ?, Now());";

  connection.query(sqlQuery, values, (err, result) => {
    if (err) {
      console.error("Error inserting into database:", err);
      res.status(500).send("Intenal Server Error");
    } else {
      res.status(200).send("Files and text data upload and database updated");
    }
  });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "server/images/");
  },
  filename: (req, file, cb) => {
    var ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});

const upload = multer({ storage: storage });

app.post("/review", upload.array("files", 4), async (req, res) => {
  const { userid, orderid, prodid, title, content, rate } = req.body;
  const fileColumns = ["img1", "img2", "img3", "img4"];
  const filePaths = req.files.map((file, index) => ({
    column: fileColumns[index],
    path: file.path.replace("server/", ""),
  }));
  console.log(filePaths[0]);
  const columns = [
    "date",
    "userid",
    "orderid",
    "prodid",
    "title",
    "content",
    "rate",
  ];
  const values = [userid, orderid, prodid, title, content, rate];

  filePaths.forEach((file) => {
    if (file.path) {
      const imageUrl = `http://localhost:8000/${file.path
        .replace(/\\/g, "/")
        .replace("images/", "")
        .replace("server/", "")}`;
      columns.push(file.column);
      values.push(imageUrl);
    }
  });

  const sqlQuery = `INSERT INTO ezteam2.productreview (${columns.join(
    ", "
  )}) VALUES (Now(), ${Array(values.length).fill("?").join(", ")});`;

  // const values = [ userid, orderid, prodid, title, content, rate, ...filePaths.map(file => file.path)];

  connection.query(sqlQuery, values, (err, result) => {
    if (err) {
      console.error("Error inserting into database:", err);
      res.status(500).send("Intenal Server Error");
    } else {
      res.status(200).send("Files and text data upload and database updated");
    }
  });
});

app.put("/review", upload.array('files', 4), async(req, res) => {
  const { reviewid, title, content, rate} = req.body;
  const fileColumns = ['img1', 'img2', 'img3', 'img4'];
  const filePaths = req.files.map((file, index) => ({
      column: fileColumns[index],
      path: file.path
  }));
  const columns = ['title', 'content', 'rate'];
  const values = [ title, content, rate];

  filePaths.forEach(file => {
    if (file.path) {
        const imageUrl = `http://localhost:8000/${file.path.replace(/\\/g, "/")
        .replace("images/", "")
        .replace("server/", "")}`;
        columns.push(file.column);
        values.push(imageUrl);
    }
  });

  const placeholders = columns.map(column => `${column} = ?`).join(', ');

  const exQuery = `UPDATE ezteam2.productreview SET img1 = null, img2 = null, img3 = null, img4 = null WHERE reviewid = ${reviewid}`

  connection.query(exQuery, (err, result) => {
    if(err) {
      console.error('error!!', err);
      res.status(500).send('Internal Server Error')
    }
    else {
      const sqlQuery = `UPDATE ezteam2.productreview SET ${placeholders}, date = Now() WHERE reviewid = ?`;
      values.push(reviewid);

      connection.query(sqlQuery, values, (err, result) => {
        if(err) {
          console.error('Error updating into database:',err);
          res.status(500).send('Internal Server Error')
        }
        else {
          res.status(200).send('Files and text data upload and database updated');
        }
      });
    }  
  })
});

app.post("/img", upload.single("img"), (req, res) => {
  const IMG_URL = `http://localhost:8000/${req.file.filename}`;
  res.json({ url: IMG_URL });
});

app.post("/register", upload.array("files", 5), async (req, res) => {
  const { title, price, category, description } = req.body;
  const fileColumns = ["thumbnail", "img1", "img2", "img3", "img4"];
  const filePaths = req.files.map((file, index) => ({
    column: fileColumns[index],
    path: file.path.replace("server/", ""),
  }));

  const columns = [
    "prodid",
    "date",
    "title",
    "price",
    "category",
    "description",
  ];
  const values = [title, price, category, description];

  filePaths.forEach((file) => {
    if (file.path) {
      const imageUrl = `http://localhost:8000/${file.path
        .replace(/\\/g, "/")
        .replace("images/", "")
        .replace("server/", "")}`;
      columns.push(file.column);
      values.push(imageUrl);
    }
  });

  const sqlQuery = `INSERT INTO ezteam2.shopproducts (${columns.join(
    ", "
  )}) VALUES (null, Now(), ${Array(values.length).fill("?").join(", ")});`;

  connection.query(sqlQuery, values, (err, result) => {
    if (err) {
      console.error("Error inserting into database:", err);
      res.status(500).send("Intenal Server Error");
    } else {
      res.status(200).send("Files and text data upload and database updated");
    }
  });
});

app.get("/register", (req, res) => {
  const sqlQuery = "SELECT * FROM ezteam2.SHOPPRODUCTS;";
  connection.query(sqlQuery, (err, result) => {
    res.send(result);
  });
});

app.get("/banner", (req, res) => {
  const sqlQuery = "SELECT * FROM ezteam2.SHOPBANNER";
  connection.query(sqlQuery, (err, result) => {
    res.send(result);
  });
});

app.get("/ordercount", (req, res) => {
  const sqlQuery =
    "SELECT sp.prodid, sp.title, sp.price, sp.thumbnail, COUNT(*) AS ordered FROM ezteam2.orders AS o INNER JOIN ezteam2.shopproducts AS sp ON o.productCode = sp.prodid GROUP BY o.productCode";
  connection.query(sqlQuery, (err, result) => {
    res.send(result);
  });
});

app.delete("/review", (req, res) => {
  const { id } = req.body;
  const value = [id];
  const sqlQuery = "DELETE FROM ezteam2.productreview WHERE reviewid = ?";
  connection.query(sqlQuery, value, (err, result) => {
    if (err) {
      console.error("Error deleting into database:", err);
      res.status(500).send("Intenal Server Error");
    } else {
      res.status(200).send("deleted");
    }
  });
});

app.post("/answer", (req, res) => {
  const values = req.body;
  const sqlQuery =
    "INSERT INTO ezteam2.productanswer (answerid, qid, answer, prodid, date) VALUES (null, ?, ?, ?, Now())";
  connection.query(sqlQuery, values, (err, result) => {
    if (err) {
      console.log("Error during inserting", err);
      res.status(500).send("Internal Server Error");
    } else {
      res.status(200).send("inserted");
    }
  });
});

app.get("/answer", (req, res) => {
  const sqlQuery = "SELECT * FROM ezteam2.productanswer";
  connection.query(sqlQuery, (err, result) => {
    res.send(result);
  });
});

// app.listen(port, () => console.log(`port${port}`)); << 원본
app.listen(app.get("port"), () => {
  console.log(app.get("port"), `port server on...`);
}); // 추가_이기현
