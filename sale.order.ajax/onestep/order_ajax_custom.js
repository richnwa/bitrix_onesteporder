BX.Sale.OrderAjaxCustomComponent = BX.Sale.OrderAjaxComponent;

BX.Sale.OrderAjaxCustomComponent.init = function(parameters) {
	this.initializePrimaryFields();

	this.result = parameters.result || {};
	this.prepareLocations(parameters.locations);
	this.params = parameters.params || {};
	this.signedParamsString = parameters.signedParamsString || '';
	this.siteId = parameters.siteID || '';
	this.ajaxUrl = parameters.ajaxUrl || '';
	this.templateFolder = parameters.templateFolder || '';
	this.defaultBasketItemLogo = this.templateFolder + "/images/product_logo.png";
	this.defaultStoreLogo = this.templateFolder + "/images/pickup_logo.png";
	this.defaultDeliveryLogo = this.templateFolder + "/images/delivery_logo.png";
	this.defaultPaySystemLogo = this.templateFolder + "/images/pay_system_logo.png";

	this.orderBlockNode = BX(parameters.orderBlockId);
	this.totalBlockNode = BX(parameters.totalBlockId);
	this.mobileTotalBlockNode = BX(parameters.totalBlockId + '-mobile');
	this.savedFilesBlockNode = BX('bx-soa-saved-files');
	this.orderSaveBlockNode = BX('bx-soa-orderSave');
	this.mainErrorsNode = BX('bx-soa-main-notifications');

	this.authBlockNode = BX(parameters.authBlockId);
	this.authHiddenBlockNode = BX(parameters.authBlockId + '-hidden');
	this.basketBlockNode = BX(parameters.basketBlockId);
	this.basketHiddenBlockNode = BX(parameters.basketBlockId + '-hidden');
	this.regionBlockNode = BX(parameters.regionBlockId);
	this.regionHiddenBlockNode = BX(parameters.regionBlockId + '-hidden');
	this.paySystemBlockNode = BX(parameters.paySystemBlockId);
	this.paySystemHiddenBlockNode = BX(parameters.paySystemBlockId + '-hidden');
	this.deliveryBlockNode = BX(parameters.deliveryBlockId);
	this.deliveryHiddenBlockNode = BX(parameters.deliveryBlockId + '-hidden');
	this.pickUpBlockNode = BX(parameters.pickUpBlockId);
	this.pickUpHiddenBlockNode = BX(parameters.pickUpBlockId + '-hidden');
	this.propsBlockNode = BX(parameters.propsBlockId);
	this.propsHiddenBlockNode = BX(parameters.propsBlockId + '-hidden');
	
	this.haveOrder = (this.result.LAST_ORDER_DATA.FAIL === undefined) ? true : false;

	if (this.result.SHOW_AUTH)
	{
		this.authBlockNode.style.display = '';
		BX.addClass(this.authBlockNode, 'bx-active');
		this.authGenerateUser = this.result.AUTH.new_user_registration_email_confirmation !== 'Y' && this.result.AUTH.new_user_phone_required !== 'Y';
		this.redirectAfterAuth = true;
	}
	else
	{
		this.redirectAfterAuth = false;
	}

	if (this.totalBlockNode)
	{
		this.totalInfoBlockNode = this.totalBlockNode.querySelector('.bx-soa-cart-total');
		this.totalGhostBlockNode = this.totalBlockNode.querySelector('.bx-soa-cart-total-ghost');
	}

	this.options.deliveriesPerPage = parseInt(parameters.params.DELIVERIES_PER_PAGE);
	this.options.paySystemsPerPage = parseInt(parameters.params.PAY_SYSTEMS_PER_PAGE);
	this.options.pickUpsPerPage = parseInt(parameters.params.PICKUPS_PER_PAGE);

	this.options.showWarnings = !!parameters.showWarnings;
	this.options.propertyValidation = !!parameters.propertyValidation;
	this.options.priceDiffWithLastTime = false;

	this.options.pickUpMap = parameters.pickUpMap;
	this.options.propertyMap = parameters.propertyMap;

	this.options.totalPriceChanged = false;

	if (!this.result.IS_AUTHORIZED || typeof this.result.LAST_ORDER_DATA.FAIL !== 'undefined')
		this.initFirstSection();

	this.initOptions();
	this.editOrder();
	this.bindEvents();

	this.orderBlockNode.removeAttribute('style');
	this.basketBlockScrollCheck();

	if (this.params.USE_ENHANCED_ECOMMERCE === 'Y')
	{
		this.setAnalyticsDataLayer('checkout');
	}

	if (this.params.USER_CONSENT === 'Y')
	{
		this.initUserConsent();
	}
	
	this.hasClick = false;
};

BX.Sale.OrderAjaxCustomComponent.editOrder = function() {
	if (!this.orderBlockNode || !this.result)
		return;

	if (this.result.DELIVERY.length > 0)
	{
		BX.addClass(this.deliveryBlockNode, 'bx-active');
		this.deliveryBlockNode.removeAttribute('style');
	}
	else
	{
		BX.removeClass(this.deliveryBlockNode, 'bx-active');
		this.deliveryBlockNode.style.display = 'none';
	}

	this.orderSaveBlockNode.style.display = this.result.SHOW_AUTH ? 'none' : '';
	this.mobileTotalBlockNode.style.display = this.result.SHOW_AUTH ? 'none' : '';

	this.checkPickUpShow();

	var sections = this.orderBlockNode.querySelectorAll('.bx-soa-section.bx-active'), i;
	for (i in sections)
	{
		if (sections.hasOwnProperty(i))
		{
			if (this.haveOrder === false || this.params.USE_PRELOAD != 'Y')
			{
				this.show(sections[i]);
			}
			
			this.editSection(sections[i]);
			
			if (sections[i].id == this.regionBlockNode.id && this.haveOrder === false || this.params.USE_PRELOAD != 'Y')
			{
				this.fixLocationsStyle(this.regionBlockNode, this.regionHiddenBlockNode);
			}
		}
	}

	this.editTotalBlock();
	this.totalBlockFixFont();

	this.showErrors(this.result.ERROR, false);
	this.showWarnings();
};

BX.Sale.OrderAjaxCustomComponent.locationsCompletion = function() {
	var i, locationNode, clearButton, inputStep, inputSearch,
		arProperty, data, section;

	this.locationsInitialized = true;
	this.fixLocationsStyle(this.regionBlockNode, this.regionHiddenBlockNode);
	this.fixLocationsStyle(this.propsBlockNode, this.propsHiddenBlockNode);

	for (i in this.locations)
	{
		if (!this.locations.hasOwnProperty(i))
			continue;

		locationNode = this.orderBlockNode.querySelector('div[data-property-id-row="' + i + '"]');
		if (!locationNode)
			continue;

		clearButton = locationNode.querySelector('div.bx-ui-sls-clear');
		inputStep = locationNode.querySelector('div.bx-ui-slst-pool');
		inputSearch = locationNode.querySelector('input.bx-ui-sls-fake[type=text]');

		locationNode.removeAttribute('style');
		this.bindValidation(i, locationNode);
		if (clearButton)
		{
			BX.bind(clearButton, 'click', function(e){
				var target = e.target || e.srcElement,
					parent = BX.findParent(target, {tagName: 'DIV', className: 'form-group'}),
					locationInput;

				if (parent)
					locationInput = parent.querySelector('input.bx-ui-sls-fake[type=text]');

				if (locationInput)
					BX.fireEvent(locationInput, 'keyup');
			});
		}

		if (!this.firstLoad && this.options.propertyValidation)
		{
			if (inputStep)
			{
				arProperty = this.validation.properties[i];
				data = this.getValidationData(arProperty, locationNode);
				section = BX.findParent(locationNode, {className: 'bx-soa-section'});

				if (section && section.getAttribute('data-visited') == 'true')
					this.isValidProperty(data);
			}

			if (inputSearch)
				BX.fireEvent(inputSearch, 'keyup');
		}
	}

	if (this.firstLoad && this.result.IS_AUTHORIZED && typeof this.result.LAST_ORDER_DATA.FAIL === 'undefined')
	{
		if (this.haveOrder === true && this.params.USE_PRELOAD == 'Y')
		{
		    this.showActualBlock();
		}
	}
	else if (!this.result.SHOW_AUTH)
	{
		this.changeVisibleContent();
	}

	this.checkNotifications();

	if (this.activeSectionId !== this.regionBlockNode.id && this.haveOrder === true && this.params.USE_PRELOAD == 'Y')
		this.editFadeRegionContent(this.regionBlockNode.querySelector('.bx-soa-section-content'));

	if (this.activeSectionId != this.propsBlockNode.id && this.haveOrder === true && this.params.USE_PRELOAD == 'Y')
		this.editFadePropsContent(this.propsBlockNode.querySelector('.bx-soa-section-content'));
};

BX.Sale.OrderAjaxCustomComponent.createPickUpItem = function(currentStore, options) {
	options = options || {};

	var imgClassName = 'bx-soa-pickup-l-item-detail',
		buttonClassName = 'bx-soa-pickup-l-item-btn',
		logoNode, logotype, html, storeNode, imgSrc;

	if (this.params.SHOW_STORES_IMAGES === 'Y')
	{
		logotype = this.getImageSources(currentStore, 'IMAGE_ID');
		imgSrc = logotype && logotype.src_1x || this.defaultStoreLogo;
		logoNode = BX.create('IMG', {
			props: {
				src: imgSrc,
				className: 'bx-soa-pickup-l-item-img'
			},
			events: {
				click: BX.delegate(function(e){
					this.popupShow(e, logotype && logotype.src_orig || imgSrc);
				}, this)
			}
		});
	}
	else
	{
		imgClassName += ' no-image';
		buttonClassName += ' no-image';
	}

	html = this.getStoreInfoHtml(currentStore);
	storeNode = BX.create('DIV', {
		props: {className: 'bx-soa-pickup-list-item', id: 'store-' + currentStore.ID},
		children: [
			BX.create('DIV', {
				props: {className: 'bx-soa-pickup-l-item-adress'},
				children: options.distance ? [
					BX.util.htmlspecialchars(currentStore.ADDRESS),
					' ( ~' + options.distance + ' ' + BX.message('SOA_DISTANCE_KM') + ' ) '
				] : [BX.util.htmlspecialchars(currentStore.ADDRESS)]
			}),
			BX.create('DIV', {
				props: {className: imgClassName},
				children: [
					logoNode,
					BX.create('DIV', {props: {className: 'bx-soa-pickup-l-item-name'}, text: currentStore.TITLE}),
					BX.create('DIV', {props: {className: 'bx-soa-pickup-l-item-desc'}, html: html})
				]
			}),
			BX.create('DIV', {
				props: {className: buttonClassName},
				children: [
					BX.create('A', {
						props: {href: '', className: 'btn btn-sm btn-default'},
						html: this.params.MESS_SELECT_PICKUP,
						events: {
							click: BX.delegate(function(event){
								this.selectStore(event);
								if (this.haveOrder === false || this.params.USE_PRELOAD != 'Y')
								{
									return BX.PreventDefault(event);
								}
								else
								{
								    this.clickNextAction(event);	
								}
							}, this)
						}
					})
				]
			})
		],
		events: {
			click: BX.proxy(this.selectStore, this)
		}
	});

	if (options.selected)
		BX.addClass(storeNode, 'bx-selected');

	return storeNode;
};

BX.Sale.OrderAjaxCustomComponent.checkPickUpShow = function() {
	var currentDelivery = this.getSelectedDelivery(), name, stores;

	if (currentDelivery && currentDelivery.STORE && currentDelivery.STORE.length)
		stores = this.getPickUpInfoArray(currentDelivery.STORE);

	if (stores && stores.length)
	{
		name = this.params.SHOW_DELIVERY_PARENT_NAMES != 'N' ? currentDelivery.NAME : currentDelivery.OWN_NAME;
		currentDelivery.STORE_MAIN = currentDelivery.STORE;
		this.activatePickUp(name);
		
		if (this.firstLoad && !this.haveOrder)
		{
			this.initMaps();
			
			if (this.maps && !this.pickUpMapFocused)
			{
				this.pickUpMapFocused = true;
				setTimeout(BX.proxy(this.maps.pickUpMapFocusWaiter, this.maps), 200);
			}
			
			this.show(this.pickUpBlockNode);
		}
		
		this.editSection(this.pickUpBlockNode);
	}
	else
	{
		this.deactivatePickUp();
	}
};

BX.Sale.OrderAjaxCustomComponent.refreshOrder = function(result) {
	if (result.error)
	{
		this.showError(this.mainErrorsNode, result.error);
		this.animateScrollTo(this.mainErrorsNode, 800, 20);
	}
	else if (result.order.SHOW_AUTH)
	{
		var animation = result.order.OK_MESSAGE && result.order.OK_MESSAGE.length || result.order.SMS_AUTH.TYPE === 'OK' ? 'bx-step-good' : 'bx-step-bad';
		this.addAnimationEffect(this.authBlockNode, animation);
		BX.merge(this.result, result.order);
		this.editAuthBlock();
		this.showAuthBlock();
		this.showErrors(result.order.ERROR, false);
		this.animateScrollTo(this.authBlockNode);
	}
	else
	{
		if (this.redirectAfterAuth === true)
		{
			this.orderBlockNode.style.opacity = .1;
			document.location.href = location.href;
			return true;
		}
		
		this.isPriceChanged(result);

		if (this.activeSectionId !== this.deliveryBlockNode.id)
			this.deliveryCachedInfo = [];

		this.result = result.order;
		this.prepareLocations(result.locations);
		this.locationsInitialized = false;
		this.maxWaitTimeExpired = false;
		this.pickUpMapFocused = false;
		this.deliveryLocationInfo = {};

		this.initialized = {};
		this.clearHiddenBlocks();

		this.initOptions();
		this.editOrder();
		this.mapsReady && this.initMaps();
		BX.saleOrderAjax && BX.saleOrderAjax.initDeferredControl();
	}

	return true;
};

BX.Sale.OrderAjaxCustomComponent.getBlockFooter = function(node) {
	return null;
};

BX.Sale.OrderAjaxCustomComponent.showValidationResult = function(inputs, errors) {
	if (!this.hasClick)
		return;
	
	if (!inputs || !inputs.length || !errors)
		return;

	var input0 = BX.type.isElementNode(inputs[0]) ? inputs[0] : inputs[0][0],
		formGroup = BX.findParent(input0, {tagName: 'DIV', className: 'form-group'}),
		label = formGroup.querySelector('label'),
		tooltipId, inputDiv, i;

	if (label)
		tooltipId = label.getAttribute('for');

	for (i = 0; i < inputs.length; i++)
	{
		inputDiv = BX.findParent(inputs[i], {tagName: 'DIV', className: 'form-group'});
		if (errors[i] && errors[i].length)
			BX.addClass(inputDiv, 'has-error');
		else
			BX.removeClass(inputDiv, 'has-error');
	}

	if (errors.length)
		this.showErrorTooltip(tooltipId, label, errors.join('<br>'));
	else
		this.closeErrorTooltip(tooltipId);
};

BX.Sale.OrderAjaxCustomComponent.clickOrderSaveAction = function(event) {
	this.hasClick = true;
	
	if (this.isValidForm())
	{
		this.allowOrderSave();

		if (this.params.USER_CONSENT === 'Y' && BX.UserConsent)
		{
			BX.onCustomEvent('bx-soa-order-save', []);
		}
		else
		{
			this.doSaveAction();
		}
	}

	return BX.PreventDefault(event);
};