import blog from "./blog.json";
import changelog from "./changelog.json";
import contact from "./contact.json";
import footer from "./footer.json";
import home from "./home.json";
import nav from "./nav.json";
import notFound from "./notFound.json";
import pricing from "./pricing.json";

export default {
	...blog,
	...changelog,
	...contact,
	...footer,
	...home,
	...nav,
	...notFound,
	...pricing,
};
